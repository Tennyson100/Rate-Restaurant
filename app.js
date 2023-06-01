const express = require('express')
const app = express()
const path = require('path')
const session = require('express-session');
const ejsMate = require('ejs-mate');
const flash = require('connect-flash');
const methodOverride = require('method-override')
const Restaurant = require('./models/restaurant')
const mongoose = require('mongoose')
const Review = require('./models/review');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const User = require('./models/user');
const { isLoggedIn } = require('./views/middleware');
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
const dbURL = process.env.DB_URL || 'mongodb://localhost:27017/mis';
mongoose.connect(dbURL, {
    // newUserParser: true,
    // useCreateIndex: true,
    // useUnifiedTopology: true
});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database Connected");
});
const sessionConfig = {
    secret: 'thisshouldbeabettersecret!',
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}
app.use(express.static(path.join(__dirname, 'public')))
app.use(session(sessionConfig))
app.use(flash());
app.engine('ejs', ejsMate)
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
app.use((req, res, next) => {
    console.log(req.session)
    res.locals.currentUser = req.user;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
})
app.get('/', (req, res) => {
    res.render('home.ejs');
})
app.get('/register', (req, res) => {
    res.render('users/register.ejs');
});
app.get('/restaurants/new', isLoggedIn, (req, res) => {
    res.render('restaurants/new');
})
app.post('/restaurants', isLoggedIn, async (req, res) => {
    const restaurant = new Restaurant(req.body.restaurant);
    await restaurant.save();
    req.flash('success', 'Successfully made a new restaurant!');
    res.redirect(`/restaurants/${restaurant._id}`)
})
app.get('/restaurants/:id/edit', isLoggedIn, async (req, res) => {
    const restaurant = await Restaurant.findById(req.params.id)
    res.render('restaurants/edit', { restaurant });
})
app.get('/restaurants', async (req, res) => {
    const restaurants = await Restaurant.find({});
    res.render('restaurants/index', { restaurants })
})
app.get('/restaurants/:id', (async (req, res,) => {
    const restaurant = await Restaurant.findById(req.params.id).populate('reviews');
    res.render('restaurants/show', { restaurant });
}));
app.put('/restaurants/:id', isLoggedIn, async (req, res) => {
    const { id } = req.params;
    const restaurant = await Restaurant.findByIdAndUpdate(id, { ...req.body.restaurant });
    res.redirect(`/restaurants/${restaurant._id}`)
});
app.delete('/restaurants/:id', isLoggedIn, async (req, res) => {
    const { id } = req.params;
    await Restaurant.findByIdAndDelete(id);
    res.redirect('/restaurants');
})
app.post('/restaurants/:id/reviews', isLoggedIn, async (req, res) => {
    const restaurant = await Restaurant.findById(req.params.id);
    const review = new Review(req.body.review);
    restaurant.reviews.push(review);
    await review.save();
    await restaurant.save();
    res.redirect(`/restaurants/${restaurant._id}`);
})
app.delete('/restaurants/:id/reviews/:reviewId', isLoggedIn, async (req, res) => {
    const { id, reviewId } = req.params;
    await Restaurant.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
    await Review.findByIdAndDelete(reviewId);
    res.redirect(`/restaurants/${id}`);
})
app.get('/login', (req, res) => {
    res.render('users/login');
})
app.post('/login', passport.authenticate('local', { failureFlash: true, failureRedirect: '/login' }), (req, res) => {
    req.flash('success', 'Welcome back!');
    res.redirect('/restaurants');
})
app.post('/register', async (req, res, next) => {
    try {
        const { email, username, password } = req.body;
        const user = new User({ email, username });
        const registeredUser = await User.register(user, password);
        req.login(registeredUser, err => {
            if (err) return next(err);
            req.flash('success', 'Welcome to Meal Master!');
            res.redirect('/restaurants');
        })
    } catch (e) {
        req.flash('error', e.message);
        res.redirect('register');
    }
});
app.get('/logout', isLoggedIn, (req, res, next) => {
    req.logout(function (err) {
        if (err) {
            return next(err);
        }
        req.flash('success', 'Goodbye!');
        res.redirect('/restaurants');
    });
});
app.listen(3000, () => {
    console.log('Serving on Port 3000')
})