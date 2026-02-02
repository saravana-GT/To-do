import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore'; // Removed limit for now
import TaskBubble from './TaskBubble';
import { debounce } from 'lodash';
import { motion } from 'framer-motion';

const TaskNebula = () => {
    const [tasks, setTasks] = useState([]);
    const [newTask, setNewTask] = useState('');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [listeningForCommand, setListeningForCommand] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    const debouncedSearch = useCallback(
        debounce((nextValue) => setDebouncedSearchTerm(nextValue), 300),
        []
    );

    const handleSearchChange = (e) => {
        const { value } = e.target;
        setSearchTerm(value);
        debouncedSearch(value);
    };

    // Request Notification Permission on load
    useEffect(() => {
        if ('Notification' in window && Notification.permission !== 'granted') {
            Notification.requestPermission();
        }
    }, []);

    // Real-time subscription to tasks
    useEffect(() => {
        const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const tasksData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setTasks(tasksData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // --- Ref Pattern for Fresh Logic Access ---
    const processCommandRef = React.useRef(null);
    const recognitionRef = React.useRef(null);
    const isBotSpeakingRef = React.useRef(false);

    // Auto-Correct / Polish Text Utility
    const polishText = (text) => {
        if (!text) return "";
        // 1. Capitalize First Letter
        let polished = text.charAt(0).toUpperCase() + text.slice(1);
        // 2. Fix common "i" grammar
        polished = polished.replace(/\bi\b/g, "I");
        // 3. Trim
        return polished.trim();
    };

    // Keep processCommand consistent
    const processCommand = useCallback((command) => {
        const lower = command.toLowerCase();

        // --- 1. Conversational Helper Function ---
        const reply = (text) => {
            speak(text);
        };

        // --- 2. Identity & Personality ---
        if (lower.includes('who are you') || lower.includes('your name')) {
            reply("I am DOM. Your Digital Operations Manager.");
            return;
        }
        if (lower.includes('meaning of life')) {
            reply("42. And finishing your tasks.");
            return;
        }

        // --- 3. Small Talk ---
        if (lower === 'hello' || lower === 'hi' || lower.includes('good morning')) {
            reply("Greetings, Commander. Ready for input.");
            return;
        }
        if (lower.includes('thank you') || lower.includes('thanks')) {
            reply("You are welcome.");
            return;
        }

        // --- 4. Utility Commands ---
        if (lower.includes('what time')) {
            reply(`It is ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
            return;
        }

        // Read Tasks
        if (lower.includes('read tasks') || lower.includes('my list')) {
            const currentTasks = tasksRef.current;
            if (currentTasks.length === 0) {
                reply("You have zero tasks.");
            } else {
                reply(`You have ${currentTasks.length} pending missions. Top one is: ${currentTasks[0].text}`);
            }
            return;
        }

        // --- 5. Task Management (The Core) ---
        if (lower.includes('shut up')) {
            reply("Standing by.");
            return;
        }

        // Confirm and Add
        const confirmations = ["Copy that.", "Affirmative.", "Task logged.", "Sure thing.", "On it."];
        const randomConfirm = confirmations[Math.floor(Math.random() * confirmations.length)];

        // Auto-correct the input for the Task List
        const finalTaskText = polishText(command);

        // Force Visual Confirmation 
        setStatusMessage(`Creating Task: ${finalTaskText} ⚡`);
        reply(`${randomConfirm} Adding ${command}`);

        addTask(finalTaskText);
    }, [tasks]);

    // Update the ref on every render
    useEffect(() => {
        processCommandRef.current = processCommand;
    }, [processCommand]);

    // Text-to-Speech Helper with "Turn Taking" (Pauses Mic)
    const speak = (text) => {
        // 1. Pause Listening (Stop the ear so we don't hear ourselves)
        isBotSpeakingRef.current = true;
        if (recognitionRef.current) {
            try {
                recognitionRef.current.abort(); // abort() stops immediately, stop() processes current buffer
                console.log("Mic Paused for Speech 🛑");
            } catch (e) {
                console.log("Error pausing mic", e);
            }
        }

        const utterance = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const robotVoice = voices.find(v => v.name.includes("Google US English") || v.name.includes("Microsoft Zira"));
        if (robotVoice) utterance.voice = robotVoice;
        utterance.pitch = 1.0;
        utterance.rate = 1.0;

        // 2. Resume Listening Argument
        utterance.onend = () => {
            console.log("Speech Finished. Resuming Mic... 🎤");
            isBotSpeakingRef.current = false;

            // Only restart if the "Master Switch" (isListening) is still ON
            if (isListening && recognitionRef.current) {
                try {
                    recognitionRef.current.start();
                    setStatusMessage("Listening...");
                } catch (e) {
                    console.log("Error restarting mic", e);
                }
            }
        };

        window.speechSynthesis.speak(utterance);
    };

    // Wake Word Listener
    useEffect(() => {
        if (isListening) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                alert("Browser not supported");
                setIsListening(false);
                return;
            }

            const recognition = new SpeechRecognition();
            recognition.continuous = true; // We want it to stay open...
            recognition.interimResults = false;
            recognition.lang = 'en-US';

            // Assign to Ref so 'speak' can control it
            recognitionRef.current = recognition;

            recognition.onstart = () => {
                // Only update status if we aren't "restarting" silently
                if (!isBotSpeakingRef.current) {
                    if (conversationModeRef.current) setStatusMessage("Listening for next task...");
                    else setStatusMessage("Listening for 'Hey DOM'...");
                }
            };

            recognition.onresult = (event) => {
                const lastResultIndex = event.results.length - 1;
                const transcript = event.results[lastResultIndex][0].transcript.toLowerCase().trim();
                console.log("Heard:", transcript);

                // If bot is mid-speech (rare race condition), ignore input
                if (isBotSpeakingRef.current) return;

                setStatusMessage(`Heard: "${transcript}"`);

                const wakeWordRegex = /(hey|high|hi|hello)?\s*(dom|dumb|done|doom|don|dawn|damm)\b/i;
                const isWakeWord = wakeWordRegex.test(transcript);
                const isActive = conversationModeRef.current;

                if (isActive || isWakeWord) {
                    let command = transcript;

                    if (isWakeWord) {
                        command = transcript.replace(wakeWordRegex, '').trim();
                    }

                    if (command.length > 0) {
                        if (processCommandRef.current) {
                            processCommandRef.current(command);
                        }
                    } else if (isWakeWord) {
                        speak("Yes Commander?");
                        setStatusMessage("Listening (Active)...");
                    }

                    // Refresh Conversation Mode
                    conversationModeRef.current = true;
                    if (conversationTimeoutRef.current) clearTimeout(conversationTimeoutRef.current);
                    conversationTimeoutRef.current = setTimeout(() => {
                        conversationModeRef.current = false;
                        setStatusMessage("Standing By... (Say 'Hey DOM')");
                        speak("Standing by.");
                    }, 8000);
                }
            };

            recognition.onerror = (e) => {
                console.error("Wake word error", e);
                if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                    setIsListening(false);
                    alert("Check Microphone Permission");
                }
            };

            recognition.onend = () => {
                // Critical: Only restart if we are NOT intentionally pausing for speech
                if (isBotSpeakingRef.current) {
                    console.log("Mic stopped for speech (Intentional). Waiting for finish.");
                    return;
                }

                console.log("Mic stopped unexpectedly. Restarting listener...");
                if (isListening) {
                    setTimeout(() => {
                        try { recognition.start(); } catch (e) { console.log("Restart fail", e); }
                    }, 100);
                }
            };

            try { recognition.start(); } catch (e) { console.log(e) }
        } else {
            // Cleanup if isListening becomes false
            if (recognitionRef.current) recognitionRef.current.stop();
        }

        return () => {
            if (conversationTimeoutRef.current) clearTimeout(conversationTimeoutRef.current);
            if (recognitionRef.current) recognitionRef.current.stop();
        };
    }, [isListening]);

    const scheduleNotification = (text, date) => {
        const timeUntil = date.getTime() - new Date().getTime();
        if (timeUntil > 0) {
            setTimeout(() => {
                if (Notification.permission === 'granted') {
                    new Notification("Nebula Alert! 🌠", {
                        body: `Identify Signal: ${text}`,
                        icon: '/pwa-192x192.png'
                    });
                } else {
                    alert(`Nebula Alert: ${text}`);
                }
            }, timeUntil);
            console.log(`Notification scheduled for ${text} in ${timeUntil}ms`);
        }
    };

    const addTask = async (textOverride = null) => {
        const textToUse = typeof textOverride === 'string' ? textOverride : newTask;
        if (!textToUse.trim()) return;

        // Parse Date from text using basic logic or advanced chrono if needed
        let scheduledTime = null;
        let taskText = textToUse;

        try {
            const chrono = await import('chrono-node');
            const parsed = chrono.parse(textToUse);
            if (parsed.length > 0) {
                scheduledTime = parsed[0].start.date();
            }
        } catch (e) {
            console.log("Date parsing skipped", e);
        }

        if (scheduledTime) {
            scheduleNotification(taskText, scheduledTime);
        }

        try {
            await addDoc(collection(db, "tasks"), {
                text: taskText,
                createdAt: serverTimestamp(),
                completed: false,
                scheduledFor: scheduledTime ? scheduledTime.toISOString() : null
            });
            setNewTask('');
            setSearchTerm('');
            setDebouncedSearchTerm('');
        } catch (error) {
            console.error("Error adding task: ", error);
        }
    };

    const handleComplete = async (id) => {
        try {
            await deleteDoc(doc(db, "tasks", id));
        } catch (error) {
            console.error("Error deleting task", error);
        }
    };

    const filteredTasks = tasks.filter(task =>
        task.text.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    );

    return (
        <div style={{ width: '100%', height: '100vh', position: 'relative', display: 'flex', flexDirection: 'column' }}>
            {/* Header / Controls */}
            <div style={{ zIndex: 10, padding: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <input
                    type="text"
                    placeholder="Filtering nebula signals..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    style={inputStyle}
                />
            </div>

            {/* Nebula Container */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                {loading && <div style={{ color: 'white', textAlign: 'center' }}>Calibrating Sensors...</div>}

                {/* Status Indicator */}
                {isListening && <div style={{
                    position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
                    color: '#00ffcc', background: 'rgba(0,0,0,0.5)', padding: '5px 15px', borderRadius: '20px',
                    border: '1px solid #00ffcc', zIndex: 5,
                    display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                    {/* Flashing Dot if Active */}
                    {listeningForCommand || statusMessage.includes("Active") ? (
                        <span style={{ fontSize: '10px', color: 'red' }}>🔴 REC</span>
                    ) : "⚡"}
                    {statusMessage || "Sentry Mode Active"}
                </div>}


                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                    padding: '50px',
                    gap: '40px'
                }}>
                    {filteredTasks.map(task => (
                        <TaskBubble key={task.id} task={task} onComplete={handleComplete} />
                    ))}
                </div>
            </div>

            {/* Add Task Footer */}
            <div style={{ zIndex: 10, padding: '20px', display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px', alignItems: 'center' }}>
                <input
                    type="text"
                    placeholder="New Mission Objective... (or use Mic)"
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTask()}
                    style={inputStyle}
                />

                {/* Voice Command Button */}
                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                        if (!SpeechRecognition) {
                            alert("Voice features not supported in this browser. Try Chrome!");
                            return;
                        }

                        const recognition = new SpeechRecognition();
                        recognition.lang = 'en-US';
                        recognition.start();

                        recognition.onresult = (event) => {
                            const transcript = event.results[0][0].transcript;
                            setStatusMessage(`Heard: "${transcript}"`);
                            setNewTask(transcript);
                            speak(`Adding ${transcript}`);

                            setTimeout(() => {
                                addTask(transcript);
                            }, 500); // Slight delay to let user see the text and hear confirmation
                        };

                        recognition.onerror = (event) => {
                            console.error("Speech recognition error", event.error);
                        };
                    }}
                    style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        borderRadius: '50%',
                        width: '50px',
                        height: '50px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '1.5rem',
                        color: '#00ffcc',
                        boxShadow: '0 0 10px rgba(0, 255, 255, 0.3)'
                    }}
                >
                    🎙️
                </motion.button>

                {/* Always-On Toggle Button */}
                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                        if (!isListening) {
                            // First time activation often requires a user gesture for audio context
                            speak("Sentry mode activated.");
                        }
                        setIsListening(!isListening);
                    }}
                    style={{
                        background: isListening ? '#00ffcc' : 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        borderRadius: '50%',
                        width: '50px',
                        height: '50px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '1.5rem',
                        color: isListening ? '#000' : '#00ffcc',
                        boxShadow: isListening ? '0 0 20px #00ffcc' : '0 0 10px rgba(0, 255, 255, 0.3)'
                    }}
                    title="Toggle 'Hey DOM' Mode"
                >
                    🤖
                </motion.button>

                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={addTask}
                    style={buttonStyle}
                >
                    Launch
                </motion.button>
            </div>
        </div>
    );
};

const inputStyle = {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    padding: '12px 20px',
    borderRadius: '30px',
    color: 'white',
    outline: 'none',
    width: '300px',
    backdropFilter: 'blur(5px)',
    fontSize: '1rem'
};

const buttonStyle = {
    background: 'linear-gradient(45deg, #ff00cc, #3333ff)',
    border: 'none',
    padding: '12px 30px',
    borderRadius: '30px',
    color: 'white',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '1rem',
    boxShadow: '0 0 15px rgba(255, 0, 204, 0.5)'
};

export default TaskNebula;
