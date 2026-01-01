import mongoose from 'mongoose';

const TradeSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    uppercase: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['Buy', 'Sell'],
  },
  volumeLot: {
    type: Number,
    required: true,
  },
  openPrice: {
    type: Number,
    required: true,
  },
  closePrice: {
    type: Number,
    required: true,
  },
  takeProfit: {
    type: Number,
    default: null,
  },
  stopLoss: {
    type: Number,
    default: null,
  },
  profitLoss: {
    type: Number,
    required: true,
  },
  tradeDate: {
    type: Date,
    required: true,
  },
  openTime: {
    type: Date,
    default: null,
  },
  closeTime: {
    type: Date,
    default: null,
  },
  screenshotUrl: {
    type: String,
    required: true,
  },
  cloudinaryPublicId: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for better query performance
TradeSchema.index({ tradeDate: -1 });
TradeSchema.index({ symbol: 1 });
TradeSchema.index({ createdAt: -1 });

export default mongoose.models.Trade || mongoose.model('Trade', TradeSchema);

