import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Trade from '@/models/Trade';

// GET statistics for dashboard
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

    // Build date query
    let dateQuery = {};
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      dateQuery = { $gte: startDate, $lte: endDate };
    } else if (month && year) {
      const startDate = new Date(year, parseInt(month) - 1, 1);
      const endDate = new Date(year, parseInt(month), 0, 23, 59, 59, 999);
      dateQuery = { $gte: startDate, $lte: endDate };
    } else if (year && !month) {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
      dateQuery = { $gte: startDate, $lte: endDate };
    }

    const query = date ? { tradeDate: dateQuery } : {};

    // Get all trades for the period
    const trades = await Trade.find(query).sort({ tradeDate: -1 });

    // Calculate statistics
    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => t.profitLoss > 0).length;
    const losingTrades = trades.filter(t => t.profitLoss < 0).length;
    const breakEvenTrades = trades.filter(t => t.profitLoss === 0).length;

    const totalProfit = trades
      .filter(t => t.profitLoss > 0)
      .reduce((sum, t) => sum + t.profitLoss, 0);

    const totalLoss = Math.abs(
      trades
        .filter(t => t.profitLoss < 0)
        .reduce((sum, t) => sum + t.profitLoss, 0)
    );

    const netPL = trades.reduce((sum, t) => sum + t.profitLoss, 0);

    // Find best and worst days
    const dayStats = {};
    trades.forEach(trade => {
      const dayKey = trade.tradeDate.toISOString().split('T')[0];
      if (!dayStats[dayKey]) {
        dayStats[dayKey] = { profit: 0, trades: 0 };
      }
      dayStats[dayKey].profit += trade.profitLoss;
      dayStats[dayKey].trades += 1;
    });

    let bestDay = null;
    let worstDay = null;
    let bestDayProfit = -Infinity;
    let worstDayProfit = Infinity;

    Object.keys(dayStats).forEach(day => {
      if (dayStats[day].profit > bestDayProfit) {
        bestDayProfit = dayStats[day].profit;
        bestDay = { date: day, profit: dayStats[day].profit, trades: dayStats[day].trades };
      }
      if (dayStats[day].profit < worstDayProfit) {
        worstDayProfit = dayStats[day].profit;
        worstDay = { date: day, profit: dayStats[day].profit, trades: dayStats[day].trades };
      }
    });

    // Symbol-wise statistics
    const symbolStats = {};
    trades.forEach(trade => {
      if (!symbolStats[trade.symbol]) {
        symbolStats[trade.symbol] = {
          trades: 0,
          profit: 0,
          wins: 0,
          losses: 0,
        };
      }
      symbolStats[trade.symbol].trades += 1;
      symbolStats[trade.symbol].profit += trade.profitLoss;
      if (trade.profitLoss > 0) symbolStats[trade.symbol].wins += 1;
      if (trade.profitLoss < 0) symbolStats[trade.symbol].losses += 1;
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalTrades,
        winningTrades,
        losingTrades,
        breakEvenTrades,
        totalProfit,
        totalLoss,
        netPL,
        winRate: totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(2) : 0,
        bestDay,
        worstDay,
        symbolStats,
      },
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

