'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Logo from '../components/Logo';
import '../globals.css';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode] = useState('day'); // 'day', 'month', 'overall'

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      router.push('/auth/login');
      return;
    }

    setUser(JSON.parse(userData));
    loadData();
  }, [router, selectedDate, selectedMonth, selectedYear, viewMode]);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      // Load stats
      let statsUrl = '/api/stats?';
      if (viewMode === 'day') {
        statsUrl += `date=${selectedDate}`;
      } else if (viewMode === 'month') {
        statsUrl += `month=${selectedMonth}&year=${selectedYear}`;
      } else {
        statsUrl += `year=${selectedYear}`;
      }

      const statsRes = await fetch(statsUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const statsData = await statsRes.json();
      if (statsData.success) {
        setStats(statsData.stats);
      }

      // Load trades
      let tradesUrl = '/api/trades?';
      if (viewMode === 'day') {
        tradesUrl += `date=${selectedDate}`;
      } else if (viewMode === 'month') {
        tradesUrl += `month=${selectedMonth}&year=${selectedYear}`;
      } else {
        tradesUrl += `year=${selectedYear}`;
      }

      const tradesRes = await fetch(tradesUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const tradesData = await tradesRes.json();
      if (tradesData.success) {
        setTrades(tradesData.trades);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/auth/login');
  };

  const handleDelete = async (tradeId) => {
    if (!confirm('Are you sure you want to delete this trade?')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/trades/${tradeId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (data.success) {
        loadData();
      } else {
        alert(data.message || 'Failed to delete trade');
      }
    } catch (error) {
      alert('Error deleting trade');
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div>
      <nav className="navbar">
        <div className="navbar-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Logo size={36} />
            <h1>Crypto Trading Tracker</h1>
          </div>
          <div className="navbar-links">
            <Link href="/dashboard">📈 Dashboard</Link>
            <Link href="/upload">📤 Upload Trade</Link>
            {user?.role === 'admin' && <Link href="/admin">⚙️ Admin Panel</Link>}
            <span style={{ color: '#4a5568', fontSize: '14px' }}>
              👤 {user?.username} ({user?.role})
            </span>
            <button onClick={handleLogout} className="btn btn-secondary">
              🚪 Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="container">
        {/* View Mode Selector */}
        <div className="card">
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <button
              className={`btn ${viewMode === 'day' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('day')}
            >
              📅 Day View
            </button>
            <button
              className={`btn ${viewMode === 'month' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('month')}
            >
              📆 Month View
            </button>
            <button
              className={`btn ${viewMode === 'overall' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('overall')}
            >
              📊 Overall View
            </button>
          </div>

          {viewMode === 'day' && (
            <div className="input-group">
              <label>Select Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          )}

          {viewMode === 'month' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="input-group">
                <label>Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                    <option key={m} value={m}>
                      {new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label>Year</label>
                <input
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  min="2020"
                  max="2100"
                />
              </div>
            </div>
          )}

          {viewMode === 'overall' && (
            <div className="input-group">
              <label>Year</label>
              <input
                type="number"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                min="2020"
                max="2100"
              />
            </div>
          )}
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="stats-grid">
            <div className="stat-card">
              <h3>📊 Total Trades</h3>
              <div className="value">{stats.totalTrades}</div>
            </div>
            <div className="stat-card">
              <h3>💰 Net P/L (USD)</h3>
              <div className={`value ${stats.netPL >= 0 ? 'positive' : 'negative'}`}>
                ${stats.netPL.toFixed(2)}
              </div>
            </div>
            <div className="stat-card">
              <h3>📈 Total Profit</h3>
              <div className="value positive">${stats.totalProfit.toFixed(2)}</div>
            </div>
            <div className="stat-card">
              <h3>📉 Total Loss</h3>
              <div className="value negative">${stats.totalLoss.toFixed(2)}</div>
            </div>
            <div className="stat-card">
              <h3>🎯 Win Rate</h3>
              <div className="value">{stats.winRate}%</div>
            </div>
            <div className="stat-card">
              <h3>✅ Winning Trades</h3>
              <div className="value positive">{stats.winningTrades}</div>
            </div>
            <div className="stat-card">
              <h3>❌ Losing Trades</h3>
              <div className="value negative">{stats.losingTrades}</div>
            </div>
            {stats.bestDay && (
              <div className="stat-card">
                <h3>🏆 Best Day</h3>
                <div className="value positive">
                  ${stats.bestDay.profit.toFixed(2)}
                </div>
                <small>{new Date(stats.bestDay.date).toLocaleDateString()}</small>
              </div>
            )}
            {stats.worstDay && (
              <div className="stat-card">
                <h3>⚠️ Worst Day</h3>
                <div className="value negative">
                  ${stats.worstDay.profit.toFixed(2)}
                </div>
                <small>{new Date(stats.worstDay.date).toLocaleDateString()}</small>
              </div>
            )}
          </div>
        )}

        {/* Trades Table */}
        <div className="card">
          <h2>📋 Trades ({trades.length})</h2>
          {trades.length === 0 ? (
            <p>No trades found for the selected period.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Symbol</th>
                    <th>Type</th>
                    <th>Volume</th>
                    <th>Open Price</th>
                    <th>Close Price</th>
                    <th>TP</th>
                    <th>SL</th>
                    <th>P/L</th>
                    <th>Screenshot</th>
                    {user?.role === 'admin' && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade) => (
                    <tr key={trade._id}>
                      <td>{new Date(trade.tradeDate).toLocaleDateString()}</td>
                      <td><strong>{trade.symbol}</strong></td>
                      <td>{trade.type}</td>
                      <td>{trade.volumeLot}</td>
                      <td>${trade.openPrice.toFixed(2)}</td>
                      <td>${trade.closePrice.toFixed(2)}</td>
                      <td>{trade.takeProfit ? `$${trade.takeProfit.toFixed(2)}` : '-'}</td>
                      <td>{trade.stopLoss ? `$${trade.stopLoss.toFixed(2)}` : '-'}</td>
                      <td className={trade.profitLoss >= 0 ? 'positive' : 'negative'}>
                        ${trade.profitLoss.toFixed(2)}
                      </td>
                      <td>
                        <a
                          href={trade.screenshotUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                        >
                          📷 View
                        </a>
                      </td>
                      {user?.role === 'admin' && (
                        <td>
                          <button
                            onClick={() => handleDelete(trade._id)}
                            className="btn btn-danger"
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                          >
                            🗑️ Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

