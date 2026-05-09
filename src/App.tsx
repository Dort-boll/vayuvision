import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera,
  Mic,
  Volume2,
  Eye,
  Ear,
  Hand,
  Settings,
  Play,
  Pause,
  RefreshCw,
  Globe,
  Cpu,
  LogIn,
  User,
  Shield,
  Zap,
  ArrowRight,
  Menu,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { analyzeScene } from "./services/aiService";
import { speechService } from "./services/speechService";
import { LANGUAGES, AI_MODELS } from "./constants";

type AccessibilityMode = "blind" | "deaf" | "non-verbal";
type SetupPhase = "idle" | "language" | "model" | "complete";

export default function App() {
  const [isLandingVisible, setIsLandingVisible] = useState(true);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [setupPhase, setSetupPhase] = useState<SetupPhase>("idle");
  const [setupMessage, setSetupMessage] = useState(
    "Welcome to Vayu Vision. Click below to start voice setup.",
  );

  const [selectedLanguage, setSelectedLanguage] = useState(LANGUAGES[0].code);
  const [selectedModel, setSelectedModel] = useState(AI_MODELS[0].id);

  const [mode, setMode] = useState<AccessibilityMode>("blind");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentDescription, setCurrentDescription] = useState<string>("");
  const [captions, setCaptions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
        setError(null);

        if (mode === "blind") {
          speechService.speak(
            "Hi, I'm Vayu Vision! Camera is ready. Move your device to begin exploring.",
            selectedLanguage,
            () => setIsSpeaking(true),
            () => setIsSpeaking(false),
          );
        }
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Could not access the camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setIsCameraActive(false);
    }
  };

  // Capture Frame and Analyze
  const captureAndAnalyze = useCallback(
    async (
      prompt: string = "Describe this scene clearly and conversationally.",
      type: "general" | "text" | "object" | "navigation" = "general",
    ) => {
      if (!videoRef.current || !canvasRef.current || !isCameraActive) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (context && video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const base64Image = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];

        setIsAnalyzing(true);
        setError(null);

        // Customize prompt based on type
        let finalPrompt = prompt;
        if (type === "text") {
          finalPrompt = "Please perform OCR on this image. Read all visible text, including signs, labels, and small print. If it's a document, summarize the key information. Read the text exactly as it appears.";
        } else if (type === "object") {
          finalPrompt = "Identify and describe the main objects in this image. For each object, mention its color, shape, and relative position (e.g., 'to the right', 'in the foreground'). If there are people, describe their actions.";
        } else if (type === "navigation") {
          finalPrompt = "Analyze this scene for navigation and safety. Identify any obstacles, steps, doors, or clear paths. Use clock-face directions to describe where things are relative to the camera (e.g., 'obstacle at 11 o'clock'). Alert me to any immediate hazards.";
        }

        try {
          // analyzeScene now handles retries internally
          const description = await analyzeScene(
            base64Image,
            finalPrompt,
            selectedModel,
            selectedLanguage,
          );

          setCurrentDescription(description);

          if (mode === "blind" || mode === "non-verbal") {
            speechService.speak(
              description,
              selectedLanguage,
              () => setIsSpeaking(true),
              () => setIsSpeaking(false),
            );
          }

          if (mode === "deaf" || mode === "non-verbal") {
            setCaptions((prev) => [...prev, description].slice(-3)); // Keep last 3
          }
        } catch (err: any) {
          console.error("Analysis failed:", err);
          const errorMessage = err.message || "Failed to analyze the scene.";
          setError(errorMessage);
          
          if (mode === "blind" || mode === "non-verbal") {
            speechService.speak(
              "I'm having trouble analyzing the scene right now. Please try again in a moment.",
              selectedLanguage,
              () => setIsSpeaking(true),
              () => setIsSpeaking(false),
            );
          }
        } finally {
          setIsAnalyzing(false);
        }
      }
    },
    [isCameraActive, mode, selectedModel, selectedLanguage],
  );

  // Continuous Analysis Loop
  const toggleContinuousAnalysis = () => {
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
      setIsAnalyzing(false);
      speechService.stopSpeaking();
    } else {
      captureAndAnalyze(); // Initial capture
      analysisIntervalRef.current = setInterval(() => {
        captureAndAnalyze();
      }, 10000); // Analyze every 10 seconds
    }
  };

  // Voice Commands
  const handleVoiceCommandRef = useRef<() => void>(() => {});

  const handleVoiceCommand = useCallback(() => {
    if (isListening) {
      speechService.stopListening();
      setIsListening(false);
      return;
    }

    setIsListening(true);
    speechService.listen(
      (transcript) => {
        console.log("Heard:", transcript);
        const lowerTranscript = transcript.toLowerCase();
        setCaptions((prev) => [...prev, `You: ${transcript}`].slice(-3));

        let type: "general" | "text" | "object" | "navigation" = "general";
        if (
          lowerTranscript.includes("read") || 
          lowerTranscript.includes("text") || 
          lowerTranscript.includes("sign") || 
          lowerTranscript.includes("label") ||
          lowerTranscript.includes("document")
        ) {
          type = "text";
        } else if (
          lowerTranscript.includes("identify") || 
          lowerTranscript.includes("object") || 
          lowerTranscript.includes("what is") || 
          lowerTranscript.includes("who is") ||
          lowerTranscript.includes("find")
        ) {
          type = "object";
        } else if (
          lowerTranscript.includes("navigate") || 
          lowerTranscript.includes("where") || 
          lowerTranscript.includes("path") || 
          lowerTranscript.includes("obstacle") ||
          lowerTranscript.includes("safe") ||
          lowerTranscript.includes("door")
        ) {
          type = "navigation";
        }

        captureAndAnalyze(
          `The user asked: "${transcript}". Provide a relevant description of the scene based on their request.`,
          type,
        );
      },
      (err) => {
        console.error("Speech recognition error:", err);
        setIsListening(false);
        // Restart wake word listener on error
        if (isSetupComplete) {
          speechService.startWakeWordListener((transcript) => {
            speechService.stopWakeWordListener();
            speechService.speak(
              "I'm listening.",
              selectedLanguage,
              undefined,
              () => handleVoiceCommandRef.current(),
            );
          }, selectedLanguage);
        }
      },
      () => {
        setIsListening(false);
        // Restart wake word listener after listening ends
        if (isSetupComplete) {
          speechService.startWakeWordListener((transcript) => {
            speechService.stopWakeWordListener();
            speechService.speak(
              "I'm listening.",
              selectedLanguage,
              undefined,
              () => handleVoiceCommandRef.current(),
            );
          }, selectedLanguage);
        }
      },
      selectedLanguage,
    );
  }, [isListening, selectedLanguage, captureAndAnalyze, isSetupComplete]);

  useEffect(() => {
    handleVoiceCommandRef.current = handleVoiceCommand;
  }, [handleVoiceCommand]);

  // Lifecycle
  useEffect(() => {
    // Check if user is already signed in via Puter
    const checkAuth = async () => {
      if (window.puter) {
        const isSignedIn = await window.puter.auth.isSignedIn();
        if (isSignedIn) {
          const userInfo = await window.puter.auth.getUser();
          setUser(userInfo);
        }
      }
    };
    checkAuth();

    if (isSetupComplete) {
      startCamera();
      speechService.startWakeWordListener((transcript) => {
        console.log("Wake word detected:", transcript);
        speechService.stopWakeWordListener();
        speechService.speak(
          "I'm listening.",
          selectedLanguage,
          undefined,
          () => {
            handleVoiceCommandRef.current();
          },
        );
      }, selectedLanguage);
    }
    return () => {
      stopCamera();
      if (analysisIntervalRef.current)
        clearInterval(analysisIntervalRef.current);
      speechService.stopSpeaking();
      speechService.stopWakeWordListener();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, isSetupComplete, selectedLanguage]);

  const startVoiceSetup = () => {
    if (!window.puter) {
      setSetupMessage("Vayu AI engine is still loading. Please wait a moment...");
      setTimeout(startVoiceSetup, 1000);
      return;
    }
    setSetupPhase("language");
    setSetupMessage(
      "Which language would you like to use? (e.g., English, Spanish)",
    );
    speechService.speak(
      "Welcome to Vayu. Which language would you like to use? For example, say English, Spanish, or French.",
      "en-US",
      () => setIsSpeaking(true),
      () => {
        setIsSpeaking(false);
        speechService.listen(
          (transcript) => {
            const lowerTrans = transcript.toLowerCase();
            const matchedLang = LANGUAGES.find((l) =>
              lowerTrans.includes(l.name.toLowerCase().split(" ")[0]),
            );
            if (matchedLang) {
              setSelectedLanguage(matchedLang.code);
              setSetupPhase("model");
              setSetupMessage(
                `Language set to ${matchedLang.name}. Which Vayu Vision version would you like?`,
              );
              speechService.speak(
                `Great. Which version of Vayu Vision would you like to select? You can say Standard or Pro.`,
                matchedLang.code,
                () => setIsSpeaking(true),
                () => {
                  setIsSpeaking(false);
                  speechService.listen(
                    (modelTranscript) => {
                      const lowerModel = modelTranscript.toLowerCase();
                      const matchedModel = AI_MODELS.find(
                        (m) =>
                          lowerModel.includes(m.name.toLowerCase()) ||
                          lowerModel.includes(m.name.split(" ")[1]),
                      );
                      const finalModel = matchedModel
                        ? matchedModel.id
                        : AI_MODELS[0].id;
                      setSelectedModel(finalModel);
                      setSetupPhase("complete");
                      setSetupMessage("Setup complete. Starting Vayu Vision.");
                      speechService.speak(
                        "Starting Vayu Vision. I am now analyzing your surroundings.",
                        matchedLang.code,
                        () => setIsSpeaking(true),
                        () => {
                          setIsSpeaking(false);
                          setIsSetupComplete(true);
                        },
                      );
                    },
                    () => {
                      setSetupPhase("idle");
                      setSetupMessage("Error listening. Please try again.");
                    },
                    () => {},
                    matchedLang.code,
                  );
                },
              );
            } else {
              setSetupPhase("idle");
              setSetupMessage("Sorry, I didn't catch that. Please try again.");
              speechService.speak(
                "Sorry, I didn't catch that. Please try again.",
                "en-US",
              );
            }
          },
          (err) => {
            console.error(err);
            setSetupPhase("idle");
            setSetupMessage("Error listening. Please try again.");
            speechService.speak("Error listening. Please try again.", "en-US");
          },
          () => {},
          "en-US",
        );
      },
    );
  };

  const handleLogin = async () => {
    if (window.puter) {
      try {
        await window.puter.auth.signIn();
        const userInfo = await window.puter.auth.getUser();
        setUser(userInfo);
      } catch (err) {
        console.error("Login failed:", err);
      }
    }
  };

  if (isLandingVisible) {
    return (
      <div className="min-h-screen w-full bg-zinc-950 text-white font-sans selection:bg-emerald-500/30 overflow-x-hidden">
        {/* Navigation Logo & Login */}
        <nav className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-6 py-4 backdrop-blur-xl bg-black/20 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.5)]">
              <Eye size={18} className="text-black" />
            </div>
            <span className="text-xl font-bold tracking-tighter">VAYU VISION</span>
          </div>
          <div className="flex items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLogin}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full border border-white/10 transition-all"
            >
              {user ? (
                <>
                  <User size={18} className="text-emerald-400" />
                  <span className="text-sm font-medium">{user.username}</span>
                </>
              ) : (
                <>
                  <LogIn size={18} className="text-zinc-400" />
                  <span className="text-sm font-medium">Log In</span>
                </>
              )}
            </motion.button>
          </div>
        </nav>

        {/* Hero Section with Patterns */}
        <main className="relative pt-32 pb-20 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
          {/* Creative Background Patterns */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[1000px] pointer-events-none -z-10 overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[1200px] bg-gradient-to-b from-emerald-500/20 via-purple-500/10 to-transparent rounded-full blur-[140px] opacity-40" />
            
            {/* Pulsing Orbs */}
            <motion.div 
              animate={{ 
                x: [0, 150, -100, 0],
                y: [0, -150, 100, 0],
                scale: [1, 1.2, 0.9, 1],
              }}
              transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-[120px]"
            />
            <motion.div 
              animate={{ 
                x: [0, -200, 150, 0],
                y: [0, 100, -200, 0],
                scale: [1, 0.8, 1.3, 1],
              }}
              transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
              className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[140px]"
            />

            {/* Grid Pattern with Reveal */}
            <div className="absolute inset-0 grid grid-cols-6 md:grid-cols-12 gap-px mask-gradient-to-b opacity-20">
              {Array.from({ length: 144 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.03, 0.1, 0.03] }}
                  transition={{
                    duration: Math.random() * 4 + 2,
                    repeat: Infinity,
                    delay: Math.random() * 5,
                  }}
                  className="bg-white/20 w-full h-24 border border-white/5"
                />
              ))}
            </div>
          </div>

          {/* Scanner Line Animation */}
          <motion.div 
            animate={{ top: ['0%', '100%', '0%'] }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent z-20 pointer-events-none"
          />

          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: { 
                opacity: 1,
                transition: { staggerChildren: 0.2 }
              }
            }}
          >
            <motion.div 
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
              }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-6 tracking-widest uppercase"
            >
              <Zap size={12} fill="currentColor" />
              Empowering Sensory Boundaries
            </motion.div>
            
            <motion.h1 
              variants={{
                hidden: { opacity: 0, scale: 0.95 },
                visible: { opacity: 1, scale: 1 }
              }}
              className="text-7xl md:text-[10rem] font-black tracking-tighter mb-8 leading-[0.7] bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-white/20 select-none"
            >
              VAYU <br/>
              <motion.span 
                animate={{ 
                  color: ["#10b981", "#8b5cf6", "#3b82f6", "#10b981"],
                  textShadow: ["0 0 20px rgba(16,185,129,0)", "0 0 40px rgba(16,185,129,0.5)", "0 0 20px rgba(16,185,129,0)"],
                }}
                transition={{ duration: 8, repeat: Infinity }}
                className="italic font-light text-5xl md:text-8xl decoration-emerald-500 underline underline-offset-[12px]"
              >
                VISION
              </motion.span>
            </motion.h1>
            
            <motion.p 
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1 }
              }}
              className="text-lg md:text-2xl text-zinc-400 max-w-2xl mb-12 leading-relaxed font-light"
            >
              Experience the world through advanced AGI. Vayu Vision is a revolutionary sensory companion designed to provide seamless autonomy for users with vision and hearing impairments.
            </motion.p>

            <motion.div 
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
              }}
              className="flex flex-col md:flex-row gap-6 items-center justify-center p-2 group"
            >
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: "0 20px 40px -10px rgba(16,185,129,0.3)" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsLandingVisible(false)}
                className="group relative px-10 py-6 bg-white text-black font-black rounded-full flex items-center gap-4 overflow-hidden border-4 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
              >
                <motion.div 
                  initial={{ x: "-100%" }}
                  whileHover={{ x: "0%" }}
                  transition={{ duration: 0.4 }}
                  className="absolute inset-0 bg-emerald-500" 
                />
                <span className="relative z-10 text-xl group-hover:text-white transition-colors duration-300">Get Started</span>
                <ArrowRight className="relative z-10 transition-transform group-hover:translate-x-2 group-hover:text-white" />
              </motion.button>
            </motion.div>
          </motion.div>

          {/* Feature Grid */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-40 text-left relative">
            {/* Decorative background glow for features */}
            <div className="absolute inset-0 bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />
            
            {[
              {
                icon: <Eye className="text-emerald-400" />,
                title: "Real-time Vision",
                desc: "High-precision object and text identification focused on navigational safety.",
              },
              {
                icon: <Zap className="text-purple-400" />,
                title: "Vayu AGI",
                desc: "Proprietary intelligence engine that provides human-like context to your surroundings.",
              },
              {
                icon: <Shield className="text-blue-400" />,
                title: "Security First",
                desc: "Your data stays on your device. Privacy is at the core of our assistive mission.",
              },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, delay: i * 0.1, ease: "easeOut" }}
                whileHover={{ y: -10, borderColor: "rgba(16,185,129,0.3)" }}
                className="p-8 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-md group transition-all relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-6 border border-white/10 group-hover:bg-emerald-500/10 group-hover:rotate-12 transition-all duration-500">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold mb-3 tracking-tight">{feature.title}</h3>
                <p className="text-zinc-400 leading-relaxed font-light">{feature.desc}</p>
                
                {/* Tiny corner glow */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.div>
            ))}
          </section>
        </main>

        <footer className="mt-20 border-t border-white/5 py-12 px-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2">
              <Eye className="text-emerald-500" size={24} />
              <span className="font-bold tracking-tighter uppercase">Vayu Vision</span>
            </div>
            <p className="text-xs text-zinc-600">
              &copy; 2026 rudratech-inc.
            </p>
          </div>
        </footer>
      </div>
    );
  }

  if (!isSetupComplete) {
    return (
      <div className="min-h-screen w-full bg-zinc-950 text-white flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
        {/* Background Glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={`w-96 h-96 bg-emerald-500/20 rounded-full blur-[100px] transition-opacity duration-1000 ${isSpeaking ? "opacity-100" : "opacity-30"}`}
          />
          <div
            className={`absolute w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px] transition-opacity duration-1000 delay-100 ${isSpeaking ? "opacity-100" : "opacity-20"}`}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`max-w-md w-full bg-zinc-900/40 backdrop-blur-2xl border border-white/10 p-8 rounded-[2rem] shadow-2xl relative z-10 transition-all duration-500 ${isSpeaking ? "shadow-[0_0_50px_rgba(52,211,153,0.2)] border-emerald-500/30" : ""}`}
        >
          <div className="flex items-center justify-center mb-8">
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 ${isSpeaking ? "bg-emerald-500/30 shadow-[0_0_30px_rgba(52,211,153,0.5)] scale-110" : "bg-white/5"}`}
            >
              <Mic
                className={`transition-colors duration-500 ${isSpeaking ? "text-emerald-400" : "text-white/50"}`}
                size={36}
              />
            </div>
          </div>

          <h1 className="text-3xl font-semibold text-center mb-4 tracking-tight">
            Vayu Setup
          </h1>
          <p className="text-zinc-300 text-center mb-8 text-lg min-h-[3rem]">
            {setupMessage}
          </p>

          {setupPhase === "idle" && (
            <button
              onClick={startVoiceSetup}
              className="w-full bg-white text-black font-medium text-lg py-4 rounded-2xl hover:bg-zinc-200 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            >
              Start Voice Setup
            </button>
          )}

          {setupPhase !== "idle" && setupPhase !== "complete" && (
            <div className="flex justify-center">
              <div className="flex gap-2">
                {[1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ height: isSpeaking ? [10, 30, 10] : 10 }}
                    transition={{
                      repeat: Infinity,
                      duration: 1,
                      delay: i * 0.2,
                    }}
                    className="w-2 bg-emerald-400 rounded-full"
                  />
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-black overflow-hidden font-sans text-white p-1.5 md:p-3">
      {/* Dynamic Border Glow (Google Gemini Style) */}
      <div className={`absolute inset-0 transition-opacity duration-1000 pointer-events-none z-50 rounded-lg md:rounded-[2rem] border-2 md:border-4 ${
        isAnalyzing || isSpeaking ? "opacity-100" : "opacity-0"
      }`}>
        <div className={`absolute inset-0 rounded-lg md:rounded-[2rem] shadow-[inset_0_0_60px_rgba(139,92,246,0.5),0_0_40px_rgba(139,92,246,0.3)] transition-all duration-700 ${
          isAnalyzing ? "shadow-[inset_0_0_100px_rgba(139,92,246,0.6),0_0_50px_rgba(139,92,246,0.5)]" : "shadow-[inset_0_0_60px_rgba(16,185,129,0.5),0_0_40px_rgba(16,185,129,0.3)]"
        }`} />
        
        {/* Rapid Gradient Spin */}
        <div className="absolute inset-[-200%] bg-[conic-gradient(from_0deg,#10b981,#8b5cf6,#3b82f6,#10b981)] animate-spin-slow opacity-20 blur-[80px]" />
      </div>

      <div className="relative h-full w-full rounded-lg md:rounded-[1.8rem] overflow-hidden bg-black flex flex-col border border-white/10 shadow-2xl">
        {/* Camera Feed Background */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover opacity-80"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Blur Glass Overlay */}
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm pointer-events-none" />

        {/* Main UI Container */}
        <div className="relative z-10 h-full flex flex-col justify-between p-4 md:p-6">
          {/* Header / Status */}
          <header
            className={`flex justify-between items-center backdrop-blur-2xl bg-white/5 p-4 rounded-3xl border border-white/10 shadow-lg transition-all duration-700 ${
              isAnalyzing
                ? "shadow-[0_0_40px_rgba(139,92,246,0.5)] border-purple-500/30 scale-105"
                : isSpeaking
                  ? "shadow-[0_0_30px_rgba(52,211,153,0.4)] border-emerald-500/30"
                  : ""
            }`}
          >
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                isCameraActive ? "bg-emerald-400 animate-pulse" : "bg-red-400"
              } ${isSpeaking ? "shadow-[0_0_15px_rgba(52,211,153,0.8)]" : ""} ${isAnalyzing ? "shadow-[0_0_15px_rgba(139,92,246,0.8)] bg-purple-400" : ""}`}
            />
            <h1 className="text-xl font-semibold tracking-tight">
              Vayu Vision
            </h1>
          </div>

          {/* Mode Selector */}
          <div className="flex bg-black/40 backdrop-blur-md rounded-full p-1 border border-white/10">
            <button
              onClick={() => setMode("blind")}
              className={`p-2 rounded-full transition-all duration-300 ${mode === "blind" ? "bg-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.2)]" : "text-white/50 hover:text-white hover:bg-white/10"}`}
              aria-label="Blind Mode"
            >
              <Eye size={20} />
            </button>
            <button
              onClick={() => setMode("deaf")}
              className={`p-2 rounded-full transition-all duration-300 ${mode === "deaf" ? "bg-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.2)]" : "text-white/50 hover:text-white hover:bg-white/10"}`}
              aria-label="Deaf Mode"
            >
              <Ear size={20} />
            </button>
            <button
              onClick={() => setMode("non-verbal")}
              className={`p-2 rounded-full transition-all duration-300 ${mode === "non-verbal" ? "bg-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.2)]" : "text-white/50 hover:text-white hover:bg-white/10"}`}
              aria-label="Non-verbal Mode"
            >
              <Hand size={20} />
            </button>
          </div>
        </header>

        {/* Error Message */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/80 backdrop-blur-md text-white p-4 rounded-2xl mt-4 text-center flex flex-col items-center gap-2 border border-red-400/30 shadow-lg"
          >
            <p className="font-medium">{error}</p>
            <button 
              onClick={() => captureAndAnalyze()}
              className="bg-white/20 hover:bg-white/30 px-4 py-1 rounded-full text-sm font-semibold transition-all active:scale-95 border border-white/20"
            >
              Retry Analysis
            </button>
          </motion.div>
        )}

        {/* Center Content Area (Captions / Status) */}
        <div className="flex-1 flex flex-col justify-center items-center py-8">
          <AnimatePresence>
            {isAnalyzing && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                className="flex items-center gap-4 bg-black/40 backdrop-blur-2xl px-8 py-5 rounded-full border border-purple-500/30 shadow-[0_0_50px_rgba(139,92,246,0.4)] relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-emerald-500/10 to-blue-500/10 animate-pulse" />
                <RefreshCw
                  className="animate-spin text-purple-400 relative z-10"
                  size={28}
                />
                <span className="font-medium text-xl text-white relative z-10 tracking-wide">
                  Analyzing scene...
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Captions for Deaf / Non-verbal modes */}
          {(mode === "deaf" || mode === "non-verbal") && (
            <div className="w-full max-w-2xl mt-auto space-y-3">
              {captions.map((caption, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-2xl text-lg md:text-2xl font-medium leading-relaxed shadow-lg ${
                    caption.startsWith("You:")
                      ? "bg-indigo-500/80 backdrop-blur-md ml-auto max-w-[80%]"
                      : "bg-black/60 backdrop-blur-md border border-white/10"
                  }`}
                >
                  {caption}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Controls */}
        <div className="flex flex-col gap-6 pb-4 md:pb-8">
          {/* Specialized Analysis Buttons */}
          <div className="flex justify-center gap-3 md:gap-4 overflow-x-auto pb-2 no-scrollbar">
            <button
              onClick={() => captureAndAnalyze("", "text")}
              className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2 rounded-2xl hover:bg-white/20 transition-all active:scale-95 whitespace-nowrap"
            >
              <Globe size={18} className="text-blue-400" />
              <span className="text-sm font-medium">Read Text</span>
            </button>
            <button
              onClick={() => captureAndAnalyze("", "object")}
              className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2 rounded-2xl hover:bg-white/20 transition-all active:scale-95 whitespace-nowrap"
            >
              <Cpu size={18} className="text-emerald-400" />
              <span className="text-sm font-medium">Identify Objects</span>
            </button>
            <button
              onClick={() => captureAndAnalyze("", "navigation")}
              className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2 rounded-2xl hover:bg-white/20 transition-all active:scale-95 whitespace-nowrap"
            >
              <RefreshCw size={18} className="text-purple-400" />
              <span className="text-sm font-medium">Navigation</span>
            </button>
            <button
              onClick={() => {
                setIsSetupComplete(false);
                setSetupPhase("idle");
                setSetupMessage("Welcome back. Click below to reconfigure Vayu.");
              }}
              className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2 rounded-2xl hover:bg-white/20 transition-all active:scale-95 whitespace-nowrap"
            >
              <Settings size={18} className="text-zinc-400" />
              <span className="text-sm font-medium">Settings</span>
            </button>
          </div>

          <div className="flex justify-center items-center gap-4 md:gap-6">
            {/* Analyze Button */}
            <button
              onClick={toggleContinuousAnalysis}
              className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 active:scale-95 backdrop-blur-xl border ${
                analysisIntervalRef.current
                  ? "bg-red-500/80 border-red-400/50 shadow-[0_0_40px_rgba(239,68,68,0.4)] hover:bg-red-500"
                  : "bg-white/20 border-white/40 hover:bg-white/30 hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
              }`}
              aria-label={
                analysisIntervalRef.current ? "Stop Analysis" : "Start Analysis"
              }
            >
              {analysisIntervalRef.current ? (
                <Pause size={32} className="text-white md:w-9 md:h-9" />
              ) : (
                <Play size={32} className="ml-2 text-white md:w-9 md:h-9" />
              )}
            </button>

            {/* Voice Command Button (Blind / Non-verbal) */}
            {(mode === "blind" || mode === "non-verbal") && (
              <button
                onClick={handleVoiceCommand}
                className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 active:scale-95 backdrop-blur-xl border ${
                  isListening
                    ? "bg-emerald-500/80 border-emerald-400/50 shadow-[0_0_40px_rgba(52,211,153,0.4)] animate-pulse"
                    : "bg-indigo-500/80 border-indigo-400/50 hover:bg-indigo-500 hover:shadow-[0_0_30px_rgba(99,102,241,0.4)]"
                }`}
                aria-label="Voice Command"
              >
                <Mic size={32} className="text-white md:w-9 md:h-9" />
              </button>
            )}

            {/* Manual Capture (Non-verbal) */}
            {mode === "non-verbal" && (
              <button
                onClick={() => captureAndAnalyze()}
                className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 active:scale-95 bg-white/20 backdrop-blur-xl border border-white/40 hover:bg-white/30 hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                aria-label="Capture Now"
              >
                <Camera size={32} className="md:w-9 md:h-9" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
);
}
