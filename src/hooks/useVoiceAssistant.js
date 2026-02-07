import { useState, useEffect, useRef, useCallback } from 'react';

export const useVoiceAssistant = ({ onCommand }) => {
    const [isListening, setIsListening] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    // Refs for internal state tracking without re-renders
    const recognitionRef = useRef(null);
    const isBotSpeakingRef = useRef(false);
    const conversationModeRef = useRef(false);
    const conversationTimeoutRef = useRef(null);
    const isListeningRef = useRef(isListening);

    // Sync isListening
    useEffect(() => {
        isListeningRef.current = isListening;
    }, [isListening]);

    // Text-to-Speech Helper with "Soft Mute"
    const speak = useCallback((text) => {
        isBotSpeakingRef.current = true;
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const robotVoice = voices.find(v => v.name.includes("Google US English") || v.name.includes("Microsoft Zira"));
        if (robotVoice) utterance.voice = robotVoice;
        utterance.pitch = 1.0;
        utterance.rate = 1.0;

        utterance.onend = () => {
            setTimeout(() => {
                isBotSpeakingRef.current = false;
            }, 500);
        };
        window.speechSynthesis.speak(utterance);
    }, []);

    // Speech Recognition Setup
    useEffect(() => {
        if (!isListening) {
            if (recognitionRef.current) recognitionRef.current.stop();
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Browser not supported");
            setTimeout(() => setIsListening(false), 0);
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        recognitionRef.current = recognition;

        recognition.onstart = () => {
            setStatusMessage("Listening... (Say 'Hey DOM')");
        };

        recognition.onresult = (event) => {
            if (isBotSpeakingRef.current) return;

            const lastResultIndex = event.results.length - 1;
            const transcript = event.results[lastResultIndex][0].transcript.toLowerCase().trim();
            setStatusMessage(`Heard: "${transcript}"`);

            const wakeWordRegex = /(hey|high|hi|hello)?\s*(dom|dumb|done|doom|don|dawn|damm|dome)\b/i;
            const isWakeWord = wakeWordRegex.test(transcript);
            const actionRegex = /^(add|create|remind|delete|remove|clear)\b/i;
            const isActionCommand = actionRegex.test(transcript);
            const isActive = conversationModeRef.current;

            if (isActive || isWakeWord || isActionCommand) {
                let command = transcript;

                if (wakeWordRegex.test(command)) {
                    command = command.replace(wakeWordRegex, '').trim();
                }

                if (command.length > 0) {
                    onCommand(command, speak); // Execute Logic
                } else if (isWakeWord) {
                    speak("Yes Commander?");
                    setStatusMessage("Listening (Active)...");
                }

                // Extend Conversation Mode
                conversationModeRef.current = true;
                if (conversationTimeoutRef.current) clearTimeout(conversationTimeoutRef.current);
                conversationTimeoutRef.current = setTimeout(() => {
                    conversationModeRef.current = false;
                    setStatusMessage("Standing By... (Say 'Hey DOM')");
                }, 8000);
            }
        };

        recognition.onerror = (e) => {
            console.error("Wake word error", e);
            if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                setIsListening(false);
            }
        };

        recognition.onend = () => {
            // Auto-restart if currently listening
            if (isListeningRef.current) {
                setTimeout(() => {
                    try { recognition.start(); } catch (e) { console.log("Restart fail", e); }
                }, 200);
            }
        };

        try { recognition.start(); } catch (e) { console.log(e); }

        return () => {
            if (conversationTimeoutRef.current) clearTimeout(conversationTimeoutRef.current);
            if (recognitionRef.current) recognitionRef.current.stop();
        };
    }, [isListening, onCommand, speak]);

    // Force activation (for button click)
    const activateConversation = useCallback(() => {
        conversationModeRef.current = true;
        if (conversationTimeoutRef.current) clearTimeout(conversationTimeoutRef.current);
        conversationTimeoutRef.current = setTimeout(() => {
            conversationModeRef.current = false;
            setStatusMessage("Standing By... (Say 'Hey DOM')");
        }, 10000);
    }, []);

    return { isListening, setIsListening, speak, statusMessage, activateConversation };
};
