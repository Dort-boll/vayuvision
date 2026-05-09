export class SpeechService {
  private synth: SpeechSynthesis;
  private recognition: any;
  private isListening: boolean = false;

  private wakeWordRecognition: any;
  private isWakeWordListening: boolean = false;

  constructor() {
    this.synth = window.speechSynthesis;

    // Initialize Speech Recognition
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;

      this.wakeWordRecognition = new SpeechRecognition();
      this.wakeWordRecognition.continuous = true;
      this.wakeWordRecognition.interimResults = false;
    }
  }

  public startWakeWordListener(
    onWakeWord: (transcript: string) => void,
    lang: string = "en-US",
  ) {
    if (!this.wakeWordRecognition) return;

    this.wakeWordRecognition.lang = lang;
    this.wakeWordRecognition.onresult = (event: any) => {
      const transcript =
        event.results[event.results.length - 1][0].transcript.toLowerCase();
      if (transcript.includes("hey vayu") || transcript.includes("vayu")) {
        onWakeWord(transcript);
      }
    };

    this.wakeWordRecognition.onerror = (event: any) => {
      console.warn("Wake word recognition error:", event.error);
      // If it's a fatal error, we might want to restart or stop
      if (event.error === 'not-allowed') {
        this.isWakeWordListening = false;
      }
    };

    this.wakeWordRecognition.onend = () => {
      if (this.isWakeWordListening) {
        try {
          this.wakeWordRecognition.start();
        } catch (e) {
          // Ignore if already started
        }
      }
    };

    try {
      this.isWakeWordListening = true;
      this.wakeWordRecognition.start();
    } catch (e) {
      console.error("Failed to start wake word listener:", e);
    }
  }

  public stopWakeWordListener() {
    this.isWakeWordListening = false;
    if (this.wakeWordRecognition) {
      try {
        this.wakeWordRecognition.stop();
      } catch (e) {}
    }
  }

  public speak(
    text: string,
    lang: string = "en-US",
    onStart?: () => void,
    onEnd?: () => void,
  ) {
    if (this.synth.speaking) {
      this.synth.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;

    // Try to find a female voice for the selected language
    const voices = this.synth.getVoices();
    let selectedVoice = voices.find(
      (v) =>
        v.lang.startsWith(lang.split("-")[0]) &&
        (v.name.includes("Female") ||
          v.name.includes("Samantha") ||
          v.name.includes("Google") ||
          v.name.includes("Premium")),
    );

    if (!selectedVoice) {
      selectedVoice = voices.find((v) => v.lang.startsWith(lang.split("-")[0]));
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    if (onStart) {
      utterance.onstart = onStart;
    }

    if (onEnd) {
      utterance.onend = onEnd;
    }

    this.synth.speak(utterance);
  }

  public stopSpeaking() {
    if (this.synth.speaking) {
      this.synth.cancel();
    }
  }

  public listen(
    onResult: (text: string) => void,
    onError: (error: any) => void,
    onEnd: () => void,
    lang: string = "en-US",
  ) {
    if (!this.recognition) {
      onError(new Error("Speech recognition not supported in this browser."));
      return;
    }

    if (this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }

    this.recognition.lang = lang;

    this.recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
      }
      onResult(transcript);
    };

    this.recognition.onerror = (event: any) => {
      onError(event.error);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      onEnd();
    };

    try {
      this.recognition.start();
      this.isListening = true;
    } catch (e) {
      onError(e);
    }
  }

  public stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {}
      this.isListening = false;
    }
  }
}

export const speechService = new SpeechService();
