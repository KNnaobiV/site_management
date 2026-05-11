// utils/successMessage.js

export const showSuccessMessage = (message, duration = 3000) => {
    // Store the message in localStorage
    localStorage.setItem("appSuccessMessage", JSON.stringify({ message, timestamp: Date.now() }));

    // Optional: dispatch a custom event so components can react immediately
    window.dispatchEvent(new Event("successMessageChanged"));

    // Auto-clear after duration
    window.successMessageTimeout &&
        clearTimeout(window.successMessageTimeout);

    window.successMessageTimeout = setTimeout(() => {
        localStorage.removeItem("appSuccessMessage");
        window.dispatchEvent(new Event("successMessageChanged"));
    }, duration);
};

export const getSuccessMessage = () => {
    const stored = localStorage.getItem("appSuccessMessage");
    if (!stored) return null;

    try {
        const data = JSON.parse(stored);
        // Optional: you can add logic here to expire old messages if needed
        return data.message;
    } catch (error) {
        console.error("Failed to parse success message", error);
        localStorage.removeItem("appSuccessMessage");
        return null;
    }
};