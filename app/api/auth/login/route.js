import { NextResponse } from 'next/server';
import { verifyCredentials, initializeUsers } from '@/lib/auth';

export async function POST(request) {
  try {
    // Initialize users on first login attempt
    await initializeUsers();

    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: 'Username and password are required' },
        { status: 400 }
      );
    }

    const result = await verifyCredentials(username, password);

    if (result.success) {
      return NextResponse.json({
        success: true,
        user: result.user,
        token: result.token,
      });
    } else {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

