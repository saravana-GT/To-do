import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TaskBubble = ({ task, onComplete }) => {
    const [isExploding, setIsExploding] = useState(false);

    // Randomize initial position and drift duration for organic feel
    const randomDelay = Math.random() * 2;
    const randomDuration = 5 + Math.random() * 5;

    const handleComplete = () => {
        setIsExploding(true);
        setTimeout(() => onComplete(task.id), 800); // Wait for animation
    };

    const bubbleStyle = {
        position: 'absolute',
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        borderRadius: '50%',
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        cursor: 'pointer',
        boxShadow: '0 0 15px rgba(255, 255, 255, 0.2)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        width: '120px',
        height: '120px',
        textAlign: 'center',
        userSelect: 'none',
        fontSize: '0.9rem',
    };

    return (
        <AnimatePresence>
            {!isExploding ? (
                <motion.div
                    style={bubbleStyle}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{
                        opacity: 1,
                        scale: 1,
                        x: [0, Math.random() * 30 - 15, 0],
                        y: [0, Math.random() * 30 - 15, 0],
                    }}
                    transition={{
                        x: {
                            repeat: Infinity,
                            repeatType: "mirror",
                            duration: randomDuration,
                            ease: "easeInOut",
                        },
                        y: {
                            repeat: Infinity,
                            repeatType: "mirror",
                            duration: randomDuration * 1.2,
                            ease: "easeInOut",
                        },
                        opacity: { duration: 0.5 },
                    }}
                    onClick={handleComplete}
                    whileHover={{ scale: 1.1, boxShadow: '0 0 25px rgba(100, 200, 255, 0.6)' }}
                    layout
                >
                    {task.text}
                </motion.div>
            ) : (
                <motion.div
                    style={{ ...bubbleStyle, background: 'radial-gradient(circle, #fff, transparent)', pointerEvents: 'none' }}
                    initial={{ scale: 1, opacity: 1 }}
                    animate={{ scale: 3, opacity: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                />
            )}
        </AnimatePresence>
    );
};

export default TaskBubble;
