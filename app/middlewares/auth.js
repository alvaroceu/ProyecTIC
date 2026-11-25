const PUBLIC_PATHS = ['/', '/sobre-nosotros', '/contacto', '/login', '/register'];

module.exports = (req, res, next) => {
  res.locals.user = req.session.user || null;

  if (req.session.user || PUBLIC_PATHS.includes(req.path)) {
    return next();
  }

  res.redirect('/login');
};
