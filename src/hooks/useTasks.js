import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';

export const useTasks = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const tasksRef = useRef([]);

    // Sync ref for callbacks
    useEffect(() => {
        tasksRef.current = tasks;
    }, [tasks]);

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

    const scheduleNotification = useCallback((text, date) => {
        const timeUntil = date.getTime() - new Date().getTime();
        if (timeUntil > 0) {
            setTimeout(() => {
                if (Notification.permission === 'granted') {
                    new Notification("Nebula Alert! 🌠", {
                        body: `Identify Signal: ${text}`,
                        icon: '/pwa-192x192.png'
                    });
                }
            }, timeUntil);
            console.log(`Notification scheduled for ${text} in ${timeUntil}ms`);
        }
    }, []);

    const addTask = useCallback(async (text) => {
        if (!text.trim()) return false;

        let scheduledTime = null;
        let taskText = text;

        try {
            // Lazy load chrono only when adding tasks
            const chrono = await import('chrono-node');
            const parsed = chrono.parse(text);
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
            return true;
        } catch (error) {
            console.error("Error adding task: ", error);
            return false;
        }
    }, [scheduleNotification]);

    const completeTask = useCallback(async (id) => {
        try {
            await deleteDoc(doc(db, "tasks", id));
            return true;
        } catch (error) {
            console.error("Error deleting task", error);
            return false;
        }
    }, []);

    return { tasks, loading, addTask, completeTask, tasksRef };
};
