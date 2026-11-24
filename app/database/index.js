const sequelize = require('./connection');
const User = require('./models/User');
const Board = require('./models/Board');
const Membership = require('./models/Membership');
const BoardColumn = require('./models/BoardColumn');
const Card = require('./models/Card');
const Comment = require('./models/Comment');

User.belongsToMany(Board, { through: Membership, foreignKey: 'userId', otherKey: 'boardId', onDelete: 'RESTRICT' });
Board.belongsToMany(User, { through: Membership, foreignKey: 'boardId', otherKey: 'userId', onDelete: 'CASCADE' });

User.hasMany(Membership, { foreignKey: 'userId', onDelete: 'RESTRICT' });
Membership.belongsTo(User, { foreignKey: 'userId', onDelete: 'RESTRICT' });
Board.hasMany(Membership, { foreignKey: 'boardId', onDelete: 'CASCADE' });
Membership.belongsTo(Board, { foreignKey: 'boardId', onDelete: 'CASCADE' });

Board.hasMany(BoardColumn, { foreignKey: { name: 'boardId', allowNull: false }, onDelete: 'CASCADE' });
BoardColumn.belongsTo(Board, { foreignKey: { name: 'boardId', allowNull: false }, onDelete: 'CASCADE' });

BoardColumn.hasMany(Card, { foreignKey: { name: 'columnId', allowNull: false }, onDelete: 'RESTRICT' });
Card.belongsTo(BoardColumn, { foreignKey: { name: 'columnId', allowNull: false }, onDelete: 'RESTRICT' });

Card.hasMany(Comment, { foreignKey: { name: 'cardId', allowNull: false }, onDelete: 'CASCADE' });
Comment.belongsTo(Card, { foreignKey: { name: 'cardId', allowNull: false }, onDelete: 'CASCADE' });

User.hasMany(Comment, { foreignKey: { name: 'userId', allowNull: false }, onDelete: 'RESTRICT' });
Comment.belongsTo(User, { foreignKey: { name: 'userId', allowNull: false }, onDelete: 'RESTRICT' });

module.exports = { sequelize, User, Board, Membership, BoardColumn, Card, Comment };
