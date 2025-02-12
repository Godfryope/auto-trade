function authenticateUser(telegramId) {
    const user = users.find(u => u.telegramId === telegramId);
    return user ? { success: true, name: user.name } : { success: false };
}

module.exports = authenticateUser;