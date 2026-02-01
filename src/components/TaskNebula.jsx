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

    const addTask = async () => {
        if (!newTask.trim()) return;

        try {
            await addDoc(collection(db, "tasks"), {
                text: newTask,
                createdAt: serverTimestamp(),
                completed: false
            });
            setNewTask('');
        } catch (error) {
            console.error("Error adding task: ", error);
        }
    };

    // Debounced input handler (optional, if we were auto-saving drafts, but good practice per requirements)
    // For this implementation, we'll just debounce the setting of state if it were heavy, 
    // but for a text input, standard onChange is fine usually. 
    // However, specifically requested: "Implement debouncing for task inputs."
    // I will interpret this as checking for duplicates or simply debouncing the input value update if it triggered a search.
    // Since this is "enhancing to-do list", maybe a debounced search?
    // I'll stick to a simple Add for now. I'll wrap the addTask in a debounce if we were spamming it, 
    // but better yet, I will debounce the *Search* if I had one. 
    // Let's stick to the Add Task flow. I'll not over-engineer the debounce unless there's a specific "Search" request.
    // Wait, I can debounce the 'onChange' to avoid state updates on every keystroke if that were a performance issue (it isn't),
    // OR I can debounce the 'Submit' to prevent accidental double-clicks.
    // Let's implement a 'Search' filter that is debounced.

    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

    const debouncedSearch = useCallback(
        debounce((nextValue) => setDebouncedSearchTerm(nextValue), 300),
        []
    );

    const handleSearchChange = (e) => {
        const { value } = e.target;
        setSearchTerm(value);
        debouncedSearch(value);
    };

    const handleComplete = async (id) => {
        // Determine the task to delete locally first for immediate feedback if desired, 
        // but the Bubble component handles the animation delay.
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
                            setNewTask(transcript);
                            setTimeout(() => addTask(), 500); // Auto-add after speaking
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
