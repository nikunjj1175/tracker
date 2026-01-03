import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Trade from '@/models/Trade';

// Force dynamic rendering since we use request.headers for auth
export const dynamic = 'force-dynamic';

// GET all trades with filters
export async function GET(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const symbol = searchParams.get('symbol');

    // Build query
    const query = {};
    
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      query.tradeDate = { $gte: startDate, $lte: endDate };
    }

    if (month && year) {
      const startDate = new Date(year, parseInt(month) - 1, 1);
      const endDate = new Date(year, parseInt(month), 0, 23, 59, 59, 999);
      query.tradeDate = { $gte: startDate, $lte: endDate };
    }

    if (year && !month) {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
      query.tradeDate = { $gte: startDate, $lte: endDate };
    }

    if (symbol) {
      query.symbol = symbol.toUpperCase();
    }

    const trades = await Trade.find(query)
      .sort({ tradeDate: -1, createdAt: -1 })
      .limit(1000);

    return NextResponse.json({
      success: true,
      trades,
      count: trades.length,
    });
  } catch (error) {
    console.error('Get trades error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

