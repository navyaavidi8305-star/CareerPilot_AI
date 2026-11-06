import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../index';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { sendOTPEmail } from '../utils/email';
import { AuthRequest } from '../types';
import {
  registerSchema,
  loginSchema,
  otpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../utils/validators';

export async function register(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: {
        fullName: data.fullName,
        email: data.email,
        mobile: data.mobile,
        password: hashedPassword,
        isVerified: true,
        profile: { create: {} },
      },
    });

    const token = generateAccessToken({ userId: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id, role: user.role });

    await prisma.user.update({ where: { id: user.id }, data: { refreshToken } });

    res.status(201).json({
      message: 'Registration successful.',
      token,
      refreshToken,
      user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role },
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const isValid = await bcrypt.compare(data.password, user.password);
    if (!isValid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = generateAccessToken({ userId: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id, role: user.role });

    await prisma.user.update({ where: { id: user.id }, data: { refreshToken } });

    const device = req.headers['user-agent'] || 'Unknown';
    await prisma.session.create({
      data: {
        userId: user.id,
        device,
        ip: req.ip,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.loginHistory.create({
      data: { userId: user.id, device, ip: req.ip, success: true },
    });

    res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function googleLogin(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { email, fullName, googleId, avatar } = req.body;
    if (!email || !googleId) return res.status(400).json({ error: 'Email and Google ID required' });

    let user = await prisma.user.findFirst({
      where: { OR: [{ email }, { googleId }] },
    });

    if (user) {
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId, avatar: avatar || user.avatar, isVerified: true },
        });
      }
    } else {
      const randomPassword = uuidv4() + uuidv4();
      const hashedPassword = await bcrypt.hash(randomPassword, 12);
      user = await prisma.user.create({
        data: {
          fullName,
          email,
          googleId,
          avatar,
          password: hashedPassword,
          isVerified: true,
          profile: { create: {} },
        },
      });
    }

    const token = generateAccessToken({ userId: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id, role: user.role });

    await prisma.user.update({ where: { id: user.id }, data: { refreshToken } });
    await prisma.loginHistory.create({
      data: {
        userId: user.id,
        device: req.headers['user-agent'],
        ip: req.ip,
        success: true,
      },
    });

    res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function refreshToken(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { refreshToken: token } = req.body;
    if (!token) return res.status(400).json({ error: 'Refresh token required' });

    const decoded = verifyRefreshToken(token);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || user.refreshToken !== token) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const newToken = generateAccessToken({ userId: user.id, role: user.role });
    const newRefreshToken = generateRefreshToken({ userId: user.id, role: user.role });

    await prisma.user.update({ where: { id: user.id }, data: { refreshToken: newRefreshToken } });

    res.json({ token: newToken, refreshToken: newRefreshToken });
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = forgotPasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    await prisma.passwordReset.updateMany({
      where: { userId: user.id, isUsed: false },
      data: { isUsed: true },
    });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        otp,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    try {
      await sendOTPEmail(data.email, otp, 'reset');
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
    }

    console.log(`\n[DEV] Reset OTP for ${data.email}: ${otp}\n`);

    res.json({
      message: 'OTP sent to your email',
      email: data.email,
      devOtp: process.env.NODE_ENV === 'development' ? otp : undefined,
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyResetOTP(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = otpSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const resetRecord = await prisma.passwordReset.findFirst({
      where: {
        userId: user.id,
        otp: data.otp,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!resetRecord) return res.status(400).json({ error: 'Invalid or expired OTP' });

    res.json({ message: 'OTP verified', resetToken: resetRecord.id });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = resetPasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const resetRecord = await prisma.passwordReset.findFirst({
      where: {
        userId: user.id,
        otp: data.otp,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
    });
    if (!resetRecord) return res.status(400).json({ error: 'Invalid or expired OTP' });

    const hashedPassword = await bcrypt.hash(data.password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, refreshToken: null },
    });

    await prisma.passwordReset.updateMany({
      where: { userId: user.id, isUsed: false },
      data: { isUsed: true },
    });

    await prisma.session.updateMany({
      where: { userId: user.id, isActive: true },
      data: { isActive: false },
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
}

export async function changePassword(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = changePasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isValid = await bcrypt.compare(data.currentPassword, user.password);
    if (!isValid) return res.status(400).json({ error: 'Current password is incorrect' });

    const hashedPassword = await bcrypt.hash(data.newPassword, 12);
    await prisma.user.update({
      where: { id: req.userId },
      data: { password: hashedPassword },
    });

    await prisma.securityLog.create({
      data: {
        userId: req.userId!,
        action: 'PASSWORD_CHANGED',
        details: 'Password changed successfully',
        ip: req.ip,
      },
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await prisma.user.update({
      where: { id: req.userId },
      data: { refreshToken: null },
    });

    await prisma.session.updateMany({
      where: { userId: req.userId, isActive: true },
      data: { isActive: false },
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
}

export async function logoutAllDevices(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await prisma.user.update({
      where: { id: req.userId },
      data: { refreshToken: null },
    });

    await prisma.session.updateMany({
      where: { userId: req.userId, isActive: true },
      data: { isActive: false },
    });

    await prisma.securityLog.create({
      data: {
        userId: req.userId!,
        action: 'LOGOUT_ALL_DEVICES',
        ip: req.ip,
      },
    });

    res.json({ message: 'Logged out from all devices' });
  } catch (error) {
    next(error);
  }
}

export async function getSessions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const sessions = await prisma.session.findMany({
      where: { userId: req.userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(sessions);
  } catch (error) {
    next(error);
  }
}

export async function getLoginHistory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const history = await prisma.loginHistory.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(history);
  } catch (error) {
    next(error);
  }
}

export async function getSecurityLogs(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const logs = await prisma.securityLog.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(logs);
  } catch (error) {
    next(error);
  }
}
