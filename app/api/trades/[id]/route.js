import { NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Trade from '@/models/Trade';
const { deleteFromCloudinary } = require('@/lib/cloudinary');

// GET single trade
export async function GET(request, { params }) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();
    const trade = await Trade.findById(params.id);

    if (!trade) {
      return NextResponse.json(
        { success: false, message: 'Trade not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      trade,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// UPDATE trade (Admin only)
export async function PUT(request, { params }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.authenticated || !admin.isAdmin) {
      return NextResponse.json(
        { success: false, message: 'Admin access required' },
        { status: 403 }
      );
    }

    await connectDB();
    const body = await request.json();

    const trade = await Trade.findByIdAndUpdate(
      params.id,
      { ...body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!trade) {
      return NextResponse.json(
        { success: false, message: 'Trade not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      trade,
      message: 'Trade updated successfully',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE trade (Admin only)
export async function DELETE(request, { params }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.authenticated || !admin.isAdmin) {
      return NextResponse.json(
        { success: false, message: 'Admin access required' },
        { status: 403 }
      );
    }

    await connectDB();
    const trade = await Trade.findById(params.id);

    if (!trade) {
      return NextResponse.json(
        { success: false, message: 'Trade not found' },
        { status: 404 }
      );
    }

    // Delete from Cloudinary
    if (trade.cloudinaryPublicId) {
      await deleteFromCloudinary(trade.cloudinaryPublicId);
    }

    // Delete from database
    await Trade.findByIdAndDelete(params.id);

    return NextResponse.json({
      success: true,
      message: 'Trade deleted successfully',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

