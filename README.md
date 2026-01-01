# 📊 Crypto Trading History Tracker

A personal crypto trading history management system built with Next.js, MongoDB, and Cloudinary. Automatically extracts trading data from screenshots using OCR and organizes everything in a structured way.

## 🚀 Features

- **Screenshot Upload & OCR**: Upload trading screenshots and automatically extract trade data
- **Cloudinary Integration**: Images stored in organized folder structure (Year/Month/Date)
- **MongoDB Storage**: All trade data stored securely in MongoDB
- **User Roles**: Admin and User roles with different permissions
- **Dashboard Analytics**: 
  - Day-wise statistics
  - Month-wise statistics
  - Overall summary with win rate, best/worst days
- **Secure Authentication**: JWT-based authentication with bcrypt password hashing

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 (App Router)
- **Backend**: Next.js API Routes
- **Database**: MongoDB + Mongoose
- **Image Storage**: Cloudinary
- **Authentication**: JWT + bcryptjs
- **OCR**: Tesseract.js

## 📋 Prerequisites

- Node.js 18+ installed
- MongoDB database (local or cloud)
- Cloudinary account

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd tradingGeneral
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory:
   ```env
   # MongoDB Connection
   MONGODB_URI=mongodb://localhost:27017/crypto-trading
   # Or use MongoDB Atlas:
   # MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/crypto-trading

   # Cloudinary Configuration
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret

   # Authentication
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your_nextauth_secret_key_here_generate_random_string

   # User Credentials (plain text - will be hashed on first login)
   USER_PASSWORD=your_user_password_here
   ADMIN_PASSWORD=your_admin_password_here

   # JWT Secret
   JWT_SECRET=your_jwt_secret_key_here_generate_random_string
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🔐 Default Users

On first login attempt, the system will automatically create two users:

- **Username**: `user` | **Password**: Set in `USER_PASSWORD` env variable
- **Username**: `admin` | **Password**: Set in `ADMIN_PASSWORD` env variable

## 📁 Project Structure

```
/app
 ├── api/
 │   ├── auth/
 │   │   └── login/          # Login endpoint
 │   ├── trades/             # Trade CRUD operations
 │   ├── upload-trade/       # Upload screenshot endpoint
 │   └── stats/              # Statistics endpoint
 ├── auth/
 │   └── login/              # Login page
 ├── dashboard/              # Main dashboard
 ├── upload/                 # Upload page
/models
 ├── Trade.js                # Trade schema
 ├── User.js                 # User schema
/lib
 ├── mongodb.js              # MongoDB connection
 ├── cloudinary.js          # Cloudinary integration
 └── auth.js                # Authentication utilities
/utils
 └── ocrParser.js           # OCR data extraction
```

## 🎯 Usage

### 1. Login
- Navigate to `/auth/login`
- Enter username (`user` or `admin`) and password

### 2. Upload Trade
- Go to `/upload`
- Select a screenshot image
- Choose trade date
- System will try OCR extraction automatically
- If OCR fails, manually enter trade data
- Submit to save

### 3. View Dashboard
- Go to `/dashboard`
- Switch between Day/Month/Overall views
- View statistics and trade history
- Admin users can delete trades

## 📊 Dashboard Features

### Day View
- View all trades for a specific date
- Day profit/loss summary
- Total trades count

### Month View
- View all trades for a month
- Monthly profit/loss
- Win rate for the month

### Overall View
- Yearly statistics
- Total trades, win rate
- Best and worst trading days
- Symbol-wise breakdown

## 🔒 Security Features

- JWT-based authentication
- Bcrypt password hashing
- Protected API routes
- Role-based access control (Admin/User)
- Secure image storage on Cloudinary

## 🚧 Future Enhancements

- Auto broker detection
- Multiple trading account support
- Export reports (CSV/PDF)
- Chart-based analytics
- Advanced OCR with better accuracy
- Trade editing for admin users

## 📝 Notes

- This is designed for **personal/private use only**
- OCR accuracy may vary - manual entry fallback is available
- Images are organized in Cloudinary by date automatically
- All passwords are hashed using bcrypt

## 🐛 Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running
- Check `MONGODB_URI` in `.env.local`
- Verify network connectivity if using MongoDB Atlas

### Cloudinary Upload Fails
- Verify Cloudinary credentials in `.env.local`
- Check API key permissions

### OCR Not Working
- Ensure image is clear and readable
- Try manual data entry as fallback
- Check browser console for errors

## 📄 License

This project is for personal use only.

---

**Created for personal crypto trading analysis using Next.js** 🚀

