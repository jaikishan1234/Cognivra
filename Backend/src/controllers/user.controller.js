import userModel from "../models/user.model.js";

/*
 * Update the current user's username
 * Route  POST /api/user/update-username
 * Access Private
 * Body   { newUsername }
 */
export async function updateUsername(req, res) {
    try {
        const { newUsername } = req.body;
        const userId = req.user.id;

        if (!newUsername || newUsername.trim().length < 3) {
            return res.status(400).json({
                message: "Username must be at least 3 characters",
                success: false,
            });
        }

        const trimmed = newUsername.trim();

        // Check if username is already taken by another user
        const existing = await userModel.findOne({
            username: trimmed,
            _id: { $ne: userId },
        });

        if (existing) {
            return res.status(400).json({
                message: "Username is already taken",
                success: false,
            });
        }

        const user = await userModel.findByIdAndUpdate(
            userId,
            { username: trimmed },
            { new: true }
        ).select("-password");

        res.status(200).json({
            message: "Username updated successfully",
            success: true,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
            },
        });

    } catch (err) {
        res.status(500).json({
            message: "Failed to update username",
            success: false,
            err: err.message,
        });
    }
}

/*
 * Update the current user's password
 * Route  POST /api/user/update-password
 * Access Private
 * Body   { oldPassword, newPassword }
 */
export async function updatePassword(req, res) {
    try {
        const { oldPassword, newPassword } = req.body;
        const userId = req.user.id;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({
                message: "Old and new password are required",
                success: false,
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                message: "New password must be at least 6 characters",
                success: false,
            });
        }

        // Fetch user with password field included
        const user = await userModel.findById(userId);

        if (!user) {
            return res.status(404).json({
                message: "User not found",
                success: false,
            });
        }

        // Verify the old password using the model's comparePassword method
        const isMatch = await user.comparePassword(oldPassword);

        if (!isMatch) {
            return res.status(400).json({
                message: "Current password is incorrect",
                success: false,
            });
        }

        // Assign new password — the model's pre-save hook will bcrypt hash it
        user.password = newPassword;
        await user.save();

        res.status(200).json({
            message: "Password updated successfully",
            success: true,
        });

    } catch (err) {
        res.status(500).json({
            message: "Failed to update password",
            success: false,
            err: err.message,
        });
    }
}