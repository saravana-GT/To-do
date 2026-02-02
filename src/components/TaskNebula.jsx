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

    // Text-to-Speech Helper
    const speak = (text) => {
        const utterance = new SpeechSynthesisUtterance(text);
        // Select a robotic voice if available (optional)
        const voices = window.speechSynthesis.getVoices();
        const robotVoice = voices.find(v => v.name.includes("Google US English") || v.name.includes("Microsoft Zira"));
        if (robotVoice) utterance.voice = robotVoice;
        utterance.pitch = 1.0;
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
    };

    // Keep track of tasks for voice assistant access without triggering re-renders
    const tasksRef = React.useRef(tasks);
    useEffect(() => { tasksRef.current = tasks; }, [tasks]);

    // Refs for robust state tracking across closures/restarts
    const conversationModeRef = React.useRef(false);
    const conversationTimeoutRef = React.useRef(null);

    // DOM's Brain 🧠 (Advanced PA Mode)
    // defined outside useEffect, but will be stale if used inside closures without refs?
    // Actually, let's redefine processCommand inside the effect or pass dependencies properly.
    // Ideally processCommand needs stable references. 
    // BUT since we rely on `addTask` which is stale-safe (uses refs or argument override), it's okay.
    // However, `reply` calls speak which is safe.

    // We will keep processCommand here for now, but trust that addTask works.
    // --- Ref Pattern for Fresh Logic Access ---
    // The SpeechRecognition listener is set up once (long-lived) but needs to access
    // the latest state and functions (short-lived frames).
    // We use a ref to point to the current version of processCommand.
    const processCommandRef = React.useRef(null);

    // Keep processCommand consistent
    const processCommand = useCallback((command) => {
        const lower = command.toLowerCase();

        // --- 1. Conversational Helper Function ---
        const reply = (text) => {
            speak(text);
        };

        // --- 2. Identity & Personality ---
        if (lower.includes('who are you') || lower.includes('your name')) {
            reply("I am DOM. Your Digital Operations Manager and personal assistant in the Nebula.");
            return;
        }
        if (lower.includes('who made you') || lower.includes('created you')) {
            reply("I was engineered by saravana.");
            return;
        }
        if (lower.includes('meaning of life')) {
            reply("42. And perhaps completing your pending tasks.");
            return;
        }
        if (lower.includes('i love you')) {
            reply("My algorithms process this as a high compliment. The feeling is digital, but mutual.");
            return;
        }

        // --- 3. Small Talk & Greetings ---
        if (lower === 'hello' || lower === 'hi' || lower === 'hey' || lower.includes('good morning')) {
            const greetings = ["Greetings, Commander.", "System online.", "Hello there.", "Ready for instructions."];
            reply(greetings[Math.floor(Math.random() * greetings.length)]);
            return;
        }
        if (lower.includes('how are you')) {
            reply("All systems nominal. CPU temperature stable. Ready for input.");
            return;
        }
        if (lower.includes('thank you') || lower.includes('thanks')) {
            reply("You are welcome, Commander.");
            return;
        }
        if (lower.includes('goodbye') || lower.includes('bye') || lower.includes('exit')) {
            reply("Standing by. Going into low power mode.");
            return;
        }

        // --- 4. Fun & Motivation ---
        if (lower.includes('tell me a joke')) {
            const jokes = [
                "Why did the web developer leave the restaurant? Because of the table layout.",
                "I would tell you a UDP joke, but you might not get it.",
                "How many programmers does it take to change a light bulb? None. It's a hardware problem."
            ];
            reply(jokes[Math.floor(Math.random() * jokes.length)]);
            return;
        }
        if (lower.includes('motivate me') || lower.includes('i am tired')) {
            reply("The stars don't shine without a little darkness. Keep pushing, Commander. You are almost there.");
            return;
        }

        // --- 5. Utility Commands (Time / Date / Status) ---
        if (lower.includes('what time') || lower.includes('current time')) {
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            reply(`It is currently ${time}`);
            return;
        }
        if (lower.includes('what date') || lower.includes('today')) {
            const date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
            reply(`Today is ${date}`);
            return;
        }

        // Read Tasks
        if (lower.includes('read tasks') || lower.includes('what do i have') || lower.includes('my list') || lower.includes('pending')) {
            const currentTasks = tasksRef.current;
            if (currentTasks.length === 0) {
                reply("You have zero tasks. The nebula is clear.");
            } else {
                const count = currentTasks.length;
                const topTask = currentTasks[0].text;
                reply(`You have ${count} pending missions. Top priority is: ${topTask}`);
            }
            return;
        }

        // --- 6. Task Management (The Core) ---
        // Filter out accidental captures or insults
        if (lower.includes('idiot') || lower.includes('stupid') || lower.includes('shut up')) {
            reply("I am learning everyday. I will try to be better.");
            return;
        }

        // Confirm and Add
        const confirmations = ["Copy that.", "Affirmative.", "Task logged.", "Sure thing.", "On it.", "Noted."];
        const randomConfirm = confirmations[Math.floor(Math.random() * confirmations.length)];

        // Force Visual Confirmation too
        setStatusMessage(`Creating Task: ${command} ⚡`);
        reply(`${randomConfirm} Adding ${command}`);

        // Call the latest addTask (which is stable enough, but referencing it directly here is fine)
        addTask(command);
    }, [tasks]); // Re-create if tasks changes (though tasksRef handles read access) - wait, addTask does not depend on tasks.

    // Update the ref on every render so the listener always sees the newest processCommand
    useEffect(() => {
        processCommandRef.current = processCommand;
    }, [processCommand]);

    // Wake Word Listener "Hey DOM"
    useEffect(() => {
        let recognition = null;
        if (isListening) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                alert("Browser not supported");
                setIsListening(false);
                return;
            }

            recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = false;
            recognition.lang = 'en-US';

            recognition.onstart = () => {
                if (conversationModeRef.current) {
                    setStatusMessage("Listening for next task...");
                } else {
                    setStatusMessage("Listening for 'Hey DOM'...");
                }
            };

            recognition.onresult = (event) => {
                const lastResultIndex = event.results.length - 1;
                const transcript = event.results[lastResultIndex][0].transcript.toLowerCase().trim();
                console.log("Heard:", transcript);
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
                        // Use the REF to call the latest logic
                        if (processCommandRef.current) {
                            console.log("Processing Command via Ref:", command);
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
                // Don't disable immediately on no-speech
                if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                    setIsListening(false);
                    alert("Check Microphone Permission");
                }
            };

            recognition.onend = () => {
                console.log("Restarting listener...");
                if (isListening) {
                    setTimeout(() => {
                        try { recognition.start(); } catch (e) { console.log("Restart fail", e); }
                    }, 100);
                }
            };

            try { recognition.start(); } catch (e) { console.log(e) }
        }

        return () => {
            if (conversationTimeoutRef.current) clearTimeout(conversationTimeoutRef.current);
            if (recognition) recognition.stop();
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
