// Game ------------------------------------------------------------------------

// Represents an individual game instance
function Game(height, width, context, callbacks, rootNode) {
   this.grid = [];
   for (var i = 0; i < height; i++) {
      var row = [];
      for (var j = 0; j < width; j++)
         row.push(null);
      this.grid.push(row);
   }

   this.board = document.createElement("table");
   for (var i = 0; i < this.grid.length; i++) {
      var gridRow = this.grid[i];
      var boardRow = document.createElement("tr");
      for (var j = 0; j < gridRow.length; j++) {
         var gridCell = gridRow[j];
         var boardCell = document.createElement("td");
         //boardCell.textContent = String(i) + "," + String(j);  // DEBUG
         boardRow.appendChild(boardCell);
      }
      this.board.appendChild(boardRow);
   };
   rootNode.appendChild(this.board);
   this.board.firstChild.style.display = "none";  // Hide first row

   this.currBlock = null;

   this.level = 0;
   this.score = 0;
   this.totalLinesCleared = 0;

   this.context = context;  // For .call() purposes
   this.callbacks = callbacks;
}

Game.prototype.renderBoard = function() {
   for (var i = 0; i < this.grid.length; i++)
      for (var j = 0; j < this.grid[i].length; j++) {
         this.board.childNodes[i].childNodes[j].className = "";
         if (this.grid[i][j] != null)
            this.board.childNodes[i].childNodes[j].className = this.grid[i][j];
      }

   // Add the moving block to output
   var self = this;
   this.currBlock.coords.forEach(function(coord) {
      self.board.childNodes[coord.y]
                .childNodes[coord.x].className = self.currBlock.type;
   });
}

Game.prototype.spawnBlock = function() {
   for (var j = 0; j < this.grid[0].length; j++)
      if (this.grid[1][j] != null) {
         this.callbacks.onGameOver.call(this.context);
         return;
      }
   var blockTypes = Object.keys(Block.types);
   this.currBlock = new Block(
      blockTypes[Math.floor(Math.random() * blockTypes.length)]);
}

Game.prototype.packGrid = function() {
   // Get min and max y grid-coords in block (we don't need to pack the
   // grid outside these row numbers).
   var minY = this.currBlock.coords.reduce(function(acc, coord) {
      return Math.min(acc, coord.y);
   }, this.currBlock.coords[0].y);
   var maxY = this.currBlock.coords.reduce(function(acc, coord) {
      return Math.max(acc, coord.y);
   }, this.currBlock.coords[0].y);

   var rowLength = this.grid[0].length;
   var linesCleared = 0;
   for (var i = minY; i <= maxY; i++) {
      var numSquaresInRow = this.grid[i].reduce(function(num, cell) {
         return cell ? num + 1 : num;
      }, 0);
      if (numSquaresInRow == rowLength) {
         this.grid.splice(i, 1);
         var nullRow = [];
         for (var k = 0; k < rowLength; k++)
            nullRow.push(null);
         this.grid.unshift(nullRow);
         linesCleared++;
      }
   }
   this.updateScore(linesCleared);
}

Game.prototype.updateScore = function(linesCleared) {
   // We use the following scoring formula, based on the number of lines
   // cleared and which level n the player is at:
   //         1 line    2 lines    3 lines    4 lines
   // Score:  4*(n+1)   10*(n+1)   30*(n+1)   120*(n+1)
   //
   // The level is increased by 1 for every 8 lines cleared.

   var factor = 0;
   switch (linesCleared) {
      case 1: factor = 4; break;
      case 2: factor = 10; break;
      case 3: factor = 30; break;
      case 4: factor = 120; break;
      default: break;
   }
   this.score += factor * (this.level + 1);
   this.callbacks.onScoreUpdate.call(this.context, this.score);

   // Check if game level is to be increased
   for (var k = 1; k <= linesCleared; k++)
      if ((this.totalLinesCleared + k) % 8 == 0) {
         this.level++;
         this.callbacks.onLevelUpdate.call(this.context, this.level);
      }
   this.totalLinesCleared += linesCleared;
}

Game.prototype.tick = function() {

   this.lowerBlock();
   this.renderBoard();
}

Game.prototype.userDropBlock = function() {
   var levels = this.getLevels();

   var minLevel = levels[0];
   for (var k = 1; k < levels.length; k++)
      if (levels[k] < minLevel)
         minLevel = levels[k];

   this.currBlock.coords = this.currBlock.coords.map(function(coord) {
      return coord.plus(new Coord(minLevel, 0));
   });

   var self = this;
   this.currBlock.coords.forEach(function(coord) {
      self.grid[coord.y][coord.x] = self.currBlock.type;
   });

   this.packGrid();  // Makes use of new coords in currBlock
   this.spawnBlock();
   this.renderBoard();
}

// Called both on tick and on user down move
Game.prototype.lowerBlock = function() {
   var levels = this.getLevels();
   if (levels.indexOf(0) == -1) {  // Block can move down (at least) one step
      this.currBlock.coords = this.currBlock.coords.map(function(coord) {
         return coord.plus(new Coord(1, 0));
      });
   } else {
      // Block can go no further down; put it into the grid and
      // spawn a new block.
      var self = this;
      this.currBlock.coords.forEach(function(coord) {
         self.grid[coord.y][coord.x] = self.currBlock.type;
      });
      this.packGrid();
      this.spawnBlock();
   }
   this.renderBoard();

}

Game.prototype.userMoveBlock = function(direction) {
   var newCoords = null;
   if (direction == "left") {
      newCoords = this.currBlock.coords.map(function(coord) {
         return coord.plus(new Coord(0, -1));
      });
   } else if (direction == "right") {
      newCoords = this.currBlock.coords.map(function(coord) {
         return coord.plus(new Coord(0, 1));
      });
   } else if (direction == "down") {
      this.lowerBlock();
   }
   if (newCoords && this.checkCollision(newCoords)) {
      this.currBlock.coords = newCoords;
      this.renderBoard();
   }
}

Game.prototype.userRotateBlock = function() {
   var rotationData = this.currBlock.getNextRotation();
   if (this.checkCollision(rotationData.coords)) {
      this.currBlock.coords = rotationData.coords;
      this.currBlock.rotation = rotationData.rotation;
      this.renderBoard();
   }
}

// Parameter 'coords' is a nonempty array of Coord objects to be checked
// for collision against grid borders and (resting) tetromino blocks.
Game.prototype.checkCollision = function(coords) {
   // For simplicity we check everything on each call
   for (var k = 0; k < coords.length; k++) {
      var y = coords[k].y;
      var x = coords[k].x;
      if (x < 0 || x >= this.grid[0].length ||
          y > this.grid.length - 1 ||  // TODO: add y < 1 ?
          this.grid[y][x] != null)
         return false;
   }
   return true;
}

Game.prototype.getLevels = function() {
   var levels = [];
   for (k = 0; k < this.currBlock.coords.length; k++) {
      var coord = this.currBlock.coords[k];

      var level = 0;
      while (coord.y + level + 1 < this.grid.length &&
             this.grid[coord.y + level + 1][coord.x] == null)
         level++;
      levels.push(level);
   }
   return levels;
}

// Block -----------------------------------------------------------------------

function Block(type) {
   this.type = type;   // Type of tetromino block
   this.rotation = 0;  // Current rotation of block
   // Coordinates in grid data structure taken up by block:
   this.coords = Block.types[this.type][this.rotation].map(function(coord) {
      return coord.plus(new Coord(0, 3));  // Starting coord for all blocks
   });
}

Block.prototype.getNextRotation = function() {
   // Compute how far current block is shifted from its "starting" config,
   // and use this to translate the next rotation to the same location.
   var ySteps = this.coords[0].y - Block.types[this.type][this.rotation][0].y;
   var xSteps = this.coords[0].x - Block.types[this.type][this.rotation][0].x;

   var numRotations = Object.keys(Block.types[this.type]).length;
   var nextRotation = (this.rotation + 1) % numRotations;

   var rotatedCoords = Block.types[this.type][nextRotation].map(function(coord) {
      return coord.plus(new Coord(ySteps, xSteps));
   });

   return { coords: rotatedCoords, rotation: nextRotation };
}

Block.types = {
   "I": {
      "0": [new Coord(2,0), new Coord(2,1), new Coord(2,2), new Coord(2,3)],
      "1": [new Coord(0,2), new Coord(1,2), new Coord(2,2), new Coord(3,2)],
   },
   "J": {
      "0": [new Coord(1,0), new Coord(1,1), new Coord(1,2), new Coord(2,2)],
      "1": [new Coord(0,1), new Coord(0,2), new Coord(1,1), new Coord(2,1)],
      "2": [new Coord(0,0), new Coord(1,0), new Coord(1,1), new Coord(1,2)],
      "3": [new Coord(0,1), new Coord(1,1), new Coord(2,0), new Coord(2,1)]
   },
   "L": {
      "0": [new Coord(1,0), new Coord(1,1), new Coord(1,2), new Coord(2,0)],
      "1": [new Coord(0,0), new Coord(0,1), new Coord(1,1), new Coord(2,1)],
      "2": [new Coord(0,2), new Coord(1,0), new Coord(1,1), new Coord(1,2)],
      "3": [new Coord(0,1), new Coord(1,1), new Coord(2,1), new Coord(2,2)]
   },
   "O": {
      "0": [new Coord(1,1), new Coord(1,2), new Coord(2,1), new Coord(2,2)],
   },
   "S": {
      "0": [new Coord(1,1), new Coord(1,2), new Coord(2,0), new Coord(2,1)],
      "1": [new Coord(0,1), new Coord(1,1), new Coord(1,2), new Coord(2,2)],
   },
   "T": {
      "0": [new Coord(1,0), new Coord(1,1), new Coord(1,2), new Coord(2,1)],
      "1": [new Coord(0,1), new Coord(1,1), new Coord(1,2), new Coord(2,1)],
      "2": [new Coord(0,1), new Coord(1,0), new Coord(1,1), new Coord(1,2)],
      "3": [new Coord(0,1), new Coord(1,0), new Coord(1,1), new Coord(2,1)]
   },
   "Z": {
      "0": [new Coord(1,0), new Coord(1,1), new Coord(2,1), new Coord(2,2)],
      "1": [new Coord(0,2), new Coord(1,1), new Coord(1,2), new Coord(2,1)],
   }
}

// Coord ----------------------------------------------------------------------

function Coord(y, x) {
   this.y = y;
   this.x = x;
}
Coord.prototype.plus = function(other) {
   return new Coord(this.y + other.y, this.x + other.x);
};
Coord.prototype.minus = function(other) {
   return new Coord(this.y - other.y, this.x - other.x);
};

// Quadrix ---------------------------------------------------------------------

// Main controller
function Quadrix(rootNode) {
   this.rootNode = rootNode;
   this.gameStatus = "stopped";
   this.gameTimer = 0;
   this.tickRate = Quadrix.getTickRate(0);
   this.game = new Game(21, 10, this, null, rootNode);

   var self = this;
   this.handleGameInput = function(event) {
      switch (event.keyCode) {
         case 32:  // Space
            self.game.userDropBlock();
            break;
         case 38:  // Up
            self.game.userRotateBlock();
            break;
         case 37:  // Left
            self.game.userMoveBlock("left");
            break;
         case 39:  // Right
            self.game.userMoveBlock("right");
            break;
         case 40:  // Down
            self.game.userMoveBlock("down");
            break;
         default:
            break;
      }
   };

   this.callbackHandlers = {
      onGameOver: this.stopGame,
      onScoreUpdate: this.handleScoreUpdate,
      onLevelUpdate: this.handleLevelUpdate
   };
}

Quadrix.prototype.newGame = function() {
   this.rootNode.removeChild(this.rootNode.firstChild);
   this.game = new Game(21, 10, this, this.callbackHandlers, this.rootNode);
   this.game.spawnBlock();
   this.game.renderBoard();

   document.getElementById("score").textContent = "Score: 0";
   document.getElementById("level").textContent = "Level: 0";
   
   var self = this;
   this.gameTimer = setInterval(function() {
      self.game.tick();
   }, this.tickRate);

   addEventListener("keydown", this.handleGameInput);
   this.gameStatus = "running";
}

Quadrix.prototype.pauseGame = function() {
   clearInterval(this.gameTimer);
   removeEventListener("keydown", this.handleGameInput);
   this.gameStatus = "paused";
}

Quadrix.prototype.resumeGame = function() {
   var self = this;
   this.gameTimer = setInterval(function() {
      self.game.tick();
   }, this.tickRate);

   addEventListener("keydown", this.handleGameInput);
   this.gameStatus = "running";
}

// Passed as a callback to Game, executed on game over
Quadrix.prototype.stopGame = function() {
   clearInterval(this.gameTimer);
   removeEventListener("keydown", this.handleGameInput);
   document.getElementById("action").textContent = "New game";
   this.gameStatus = "stopped";
   // TODO: hide preview box, possibly update high score
}

Quadrix.prototype.handleScoreUpdate = function(score) {
   document.getElementById("score").textContent = "Score: " + score;
}

Quadrix.prototype.handleLevelUpdate = function(level) {
   clearInterval(this.gameTimer);
   var self = this;
   this.gameTimer = setInterval(function() {
      self.game.tick();
   }, Quadrix.getTickRate(level));

   document.getElementById("level").textContent = "Level: " + level;
}

Quadrix.getTickRate = (function() {
   return function(level) {
      if (level <= 9)
         return 800 - 80 * level;
      else
         return Math.max(80 - 30 * (level - 9), 10);
   }
})();

//------------------------------------------------------------------------------

var quadrix = new Quadrix(document.getElementById("root"));

// Setup interface event handlers
var actionButton = document.getElementById("action");
actionButton.addEventListener("click", function() {
   if (quadrix.gameStatus == "stopped") {
      quadrix.newGame();
      actionButton.textContent = "Pause";
   } else if (quadrix.gameStatus == "running") {
      quadrix.pauseGame();
      actionButton.textContent = "Resume";
   } else if (quadrix.gameStatus == "paused") {
      quadrix.resumeGame();
      actionButton.textContent = "Pause";
   }
});

document.getElementById("about").addEventListener("click", function() {
   alert("Quadrix. Definitely not Tetris.\n" +
         "Written by Andreas Mellberg (andreas.mellberg@gmail.com).");
});
