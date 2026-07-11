import userModel from "../models/user.model.js";
import jwt from "jsonwebtoken";
import { sendEmail } from "../services/mail.service.js";

const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "none",
}

/**
 * @desc Register a new user
 * @route POST /api/auth/register
 * @access Public
 * @body { username, email, password }
 */
export async function register(req, res) {
    try {
        const { username, email, password } = req.body;

        const existingUser = await userModel.findOne({
            $or: [{ email }, { username }]
        })

        if (existingUser) {
            if (existingUser.verified) {
                return res.status(400).json({
                    message: "User with this email or username already exists",
                    success: false,
                    err: "User already exists"
                })
            }
            // Unverified duplicate — clear it out so they can register again
            await userModel.deleteOne({ _id: existingUser._id })
        }

        const user = await userModel.create({ username, email, password })

        const emailVerificationToken = jwt.sign({
            email: user.email,
        }, process.env.JWT_SECRET)

        await sendEmail({
            to: email,
            subject: "Welcome to Cognivra!",
            html: `
                <p>Hi ${username},</p>
                <p>Thank you for registering at <strong>Cognivra</strong>. We're excited to have you on board!</p>
                <p>Please verify your email address by clicking the link below:</p>
                <a href="${process.env.SERVER_URL}/api/auth/verify-email?token=${emailVerificationToken}">Verify Email</a>
                <p>If you did not create an account, please ignore this email.</p>
                <p>Best regards,<br>The Cognivra Team</p>
            `
        })

        res.status(201).json({
            message: "User registered successfully",
            success: true,
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        });

    } catch (err) {
        console.error("Register error:", err);
        res.status(500).json({
            message: "Something went wrong during registration",
            success: false,
            err: err.message
        })
    }
}

/**
 * @desc Login user and return JWT token
 * @route POST /api/auth/login
 * @access Public
 * @body { email, password }
 */
export async function login(req, res) {
    try {
        const { email, password } = req.body;

        const user = await userModel.findOne({ email })

        if (!user) {
            return res.status(400).json({
                message: "Invalid email or password",
                success: false,
                err: "User not found"
            })
        }

        const isPasswordMatch = await user.comparePassword(password);

        if (!isPasswordMatch) {
            return res.status(400).json({
                message: "Invalid email or password",
                success: false,
                err: "Incorrect password"
            })
        }

        if (!user.verified) {
            return res.status(400).json({
                message: "Please verify your email before logging in",
                success: false,
                err: "Email not verified"
            })
        }

        const token = jwt.sign({
            id: user._id,
            username: user.username,
        }, process.env.JWT_SECRET, { expiresIn: '15m' })

        const refreshToken = jwt.sign({
            id: user._id,
        }, process.env.JWT_SECRET, { expiresIn: '7d' })

        res.cookie("token", token, { ...cookieOptions, maxAge: 15 * 60 * 1000 })
        res.cookie("refreshToken", refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 })

        res.status(200).json({
            message: "Login successful",
            success: true,
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        })

    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({
            message: "Something went wrong during login",
            success: false,
            err: err.message
        })
    }
}


/**
 * @desc Get current logged in user's details
 * @route GET /api/auth/get-me
 * @access Private
 */
export async function getMe(req, res) {
    try {
        const userId = req.user.id;

        const user = await userModel.findById(userId).select("-password");

        if (!user) {
            return res.status(404).json({
                message: "User not found",
                success: false,
                err: "User not found"
            })
        }

        res.status(200).json({
            message: "User details fetched successfully",
            success: true,
            user
        })

    } catch (err) {
        console.error("GetMe error:", err);
        res.status(500).json({
            message: "Something went wrong fetching user details",
            success: false,
            err: err.message
        })
    }
}


/**
 * @desc Verify user's email address
 * @route GET /api/auth/verify-email
 * @access Public
 * @query { token }
 */
export async function verifyEmail(req, res) {
    const { token } = req.query;

    try {


        const decoded = jwt.verify(token, process.env.JWT_SECRET);


        const user = await userModel.findOne({ email: decoded.email });

        if (!user) {
            return res.status(400).json({
                message: "Invalid token",
                success: false,
                err: "User not found"
            })
        }

        user.verified = true;

        await user.save();

        const html =
            `
        <h1>Email Verified Successfully!</h1>
        <p>Your email has been verified. You can now log in to your account.</p>
        <a href="${process.env.CLIENT_URL}/login">Go to Login</a>
    `

        return res.send(html);
    } catch (err) {
        return res.status(400).json({
            message: "Invalid or expired token",
            success: false,
            err: err.message
        })
    }
}

/**
 * @desc Logout user
 * @route POST /api/auth/logout
 * @access Private
 */
export async function logout(req, res) {
    res.clearCookie("token", { secure: true, sameSite: "none" });
    res.clearCookie("refreshToken", { secure: true, sameSite: "none" });
    res.status(200).json({
        message: "Logged out successfully",
        success: true,
    });
}

/**
 * @desc Refresh access token using refresh token cookie
 * @route POST /api/auth/refresh
 * @access Public
 */
export async function refresh(req, res) {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        return res.status(401).json({ message: "No refresh token", success: false });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

        const newToken = jwt.sign({
            id: decoded.id,
            username: decoded.username,
        }, process.env.JWT_SECRET, { expiresIn: '15m' })

        res.cookie("token", newToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 })

        res.status(200).json({ message: "Token refreshed", success: true })
    } catch (err) {
        return res.status(401).json({ message: "Invalid refresh token", success: false });
    }
}