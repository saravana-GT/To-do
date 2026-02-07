import React, { useState, useEffect, useCallback, useMemo } from 'react';
import TaskBubble from './TaskBubble';
import { debounce } from 'lodash';
import { motion } from 'framer-motion';
import { useTasks } from '../hooks/useTasks';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import { polishText, getRandomConfirmation } from '../utils/textUtils';

const TaskNebula = () => {
    const { tasks, loading, addTask: addTaskToStore, completeTask, tasksRef } = useTasks();
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [newTask, setNewTask] = useState('');

    // Define the command handler (The "Brain" logic)
    const handleCommand = useCallback((command, speak) => {
        const lower = command.toLowerCase();

        // --- Conversational Helper ---
        const reply = (text) => speak(text);

        // --- Identity & Personality ---
        if (lower.includes('who are you') || lower.includes('your name')) {
            reply("I am DOM. Your Digital Operations Manager.");
            return;
        }
        if (lower.includes('meaning of life')) {
            reply("42. And finishing your tasks.");
            return;
        }

        // --- Small Talk ---
        if (lower === 'hello' || lower === 'hi' || lower.includes('good morning')) {
            reply("Greetings, Commander. Ready for input.");
            return;
        }
        if (lower.includes('thank you') || lower.includes('thanks')) {
            reply("You are welcome.");
            return;
        }

        // --- Utility Commands ---
        if (lower.includes('what time')) {
            reply(`It is ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
            return;
        }

        // --- Task Management ---
        if (lower.includes('read tasks') || lower.includes('my list')) {
            const currentTasks = tasksRef.current;
            if (currentTasks.length === 0) {
                reply("You have zero tasks.");
            } else {
                reply(`You have ${currentTasks.length} pending missions. Top one is: ${currentTasks[0].text}`);
            }
            return;
        }

        if (lower.includes('shut up')) {
            reply("Standing by.");
            return;
        }

        // Confirm and Add Task
        const finalTaskText = polishText(command);
        const randomConfirm = getRandomConfirmation();

        reply(`${randomConfirm} Adding ${command}`);
        addTaskToStore(finalTaskText);

    }, [addTaskToStore, tasksRef]); // Dependencies remain stable

    // Initialize Voice Assistant
    const { isListening, setIsListening, speak, statusMessage, activateConversation } = useVoiceAssistant({
        onCommand: handleCommand
    });

    // Request Notification Permission
    useEffect(() => {
        if ('Notification' in window && Notification.permission !== 'granted') {
            Notification.requestPermission();
        }
    }, []);

    // Search Logic
    const debouncedSearch = useMemo(
        () => debounce((nextValue) => setDebouncedSearchTerm(nextValue), 300),
        []
    );

    const handleSearchChange = (e) => {
        const { value } = e.target;
        setSearchTerm(value);
        debouncedSearch(value);
    };

    const handleAddTask = async () => {
        const success = await addTaskToStore(newTask);
        if (success) {
            setNewTask('');
            setSearchTerm('');
            setDebouncedSearchTerm('');
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
                    {statusMessage.includes("Active") ? (
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
                    gap: '40px',
                    alignContent: 'center'
                }}>
                    {/* Empty State */}
                    {!loading && filteredTasks.length === 0 && (
                        <div style={{
                            textAlign: 'center',
                            color: 'rgba(255,255,255,0.4)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '20px'
                        }}>
                            <div style={{ fontSize: '3rem' }}>🌌</div>
                            <div>
                                {searchTerm ? "No signals found for this frequency." : "Nebula Sector Clear. No Active Missions."}
                            </div>
                            <div style={{ fontSize: '0.8rem', maxWidth: '300px' }}>
                                Say "Hey DOM" to assign a task, or use the command line below.
                            </div>
                        </div>
                    )}

                    {filteredTasks.map(task => (
                        <TaskBubble key={task.id} task={task} onComplete={completeTask} />
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
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                    style={inputStyle}
                />

                {/* Voice Command Button */}
                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                        // Quick Voice Input (One-shot)
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
                            setNewTask(transcript);
                            speak(`Adding ${transcript}`);
                            setTimeout(() => {
                                addTaskToStore(transcript);
                                setNewTask('');
                            }, 500);
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
                            setIsListening(true);
                            activateConversation();
                            speak("Hey prabuu..");
                        } else {
                            speak("Sentry mode deactivated.");
                            setIsListening(false);
                        }
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
                    onClick={handleAddTask}
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
