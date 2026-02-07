// Text utility functions

export const polishText = (text) => {
    if (!text) return "";
    // 1. Capitalize First Letter
    let polished = text.charAt(0).toUpperCase() + text.slice(1);
    // 2. Fix common "i" grammar
    polished = polished.replace(/\bi\b/g, "I");
    // 3. Trim
    return polished.trim();
};

export const getRandomConfirmation = () => {
    const confirmations = ["Copy that.", "Affirmative.", "Task logged.", "Sure thing.", "On it."];
    return confirmations[Math.floor(Math.random() * confirmations.length)];
};
