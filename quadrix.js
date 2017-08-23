// Game ------------------------------------------------------------------------

// Represents an individual game instance
function Game(height, width, startLevel, context, callbacks, rootNode) {
   this.grid = [];
   for (var i = 0; i < height; i++) {
      var row = [];
      for (var j = 0; j < width; j++)
         row.push(null);
      this.grid.push(row);
   }

   this.board = document.createElement("table");
   this.board.id = "gameTable";
   for (var i = 0; i < this.grid.length; i++) {
      var gridRow = this.grid[i];
      var boardRow = document.createElement("tr");
      for (var j = 0; j < gridRow.length; j++) {
         var boardCell = document.createElement("td");
         //boardCell.textContent = String(i) + "," + String(j);  // DEBUG
         boardRow.appendChild(boardCell);
      }
      this.board.appendChild(boardRow);
   }
   rootNode.appendChild(this.board);
   this.board.firstChild.style.display = "none";  // Hide first row

   this.blockPreview = document.createElement("table");
   this.blockPreview.id = "previewTable";

   this.currBlock = null;
   this.nextBlockType = "";

   this.level = startLevel;
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
};

Game.prototype.spawnBlock = function() {
   for (var j = 0; j < this.grid[0].length; j++)
      if (this.grid[1][j] != null) {
         this.callbacks.onGameOver.call(this.context, this.score, this.level);
         return;
      }

   var blockTypes = Object.keys(Block.types);
   if (this.nextBlockType == "")
      this.currBlock = new Block(
            blockTypes[Math.floor(Math.random() * blockTypes.length)]);
   else
      this.currBlock = new Block(this.nextBlockType);
   this.nextBlockType =
         blockTypes[Math.floor(Math.random() * blockTypes.length)];

   // Figure out the dimensions of the table for the next block preview.
   // Unlike for the main game table we can't reuse the rows and cells,
   // since the tetrominoes are of varying dimensions and we want a
   // good-looking output.
   var nextBlockCoords = Block.types[this.nextBlockType]["0"];
   var minY = nextBlockCoords.reduce(function(acc, coord) {
      return Math.min(acc, coord.y);
   }, nextBlockCoords[0].y);
   var maxY = nextBlockCoords.reduce(function(acc, coord) {
      return Math.max(acc, coord.y);
   }, nextBlockCoords[0].y);
   var minX = nextBlockCoords.reduce(function(acc, coord) {
      return Math.min(acc, coord.x);
   }, nextBlockCoords[0].x);
   var maxX = nextBlockCoords.reduce(function(acc, coord) {
      return Math.max(acc, coord.x);
   }, nextBlockCoords[0].x);

   var height = maxY - minY + 1;
   var width = maxX - minX + 1;

   while (this.blockPreview.firstChild)
      this.blockPreview.removeChild(this.blockPreview.firstChild);

   for (var i = 0; i < height; i++) {
      var row = document.createElement("tr");
      for (var j = 0; j < width; j++) {
         var cell = document.createElement("td");
         row.appendChild(cell);
      }
      this.blockPreview.appendChild(row);
   }

   var self = this;
   nextBlockCoords.forEach(function(coord) {
      self.blockPreview.childNodes[coord.y - minY]
            .childNodes[coord.x - minX].className = self.nextBlockType;
   });
};

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
   if (linesCleared >= 4)
      flashLogo(4);
   if (linesCleared > 0)
      this.updateScore(linesCleared);

};

var flashLogo = (function() {
   var counter = 1;
   var on = false;
   return function(times) {
      var logo = document.getElementById("header");
      if (!on) {
         logo.style.color = "rgba(255, 255, 255, 0.9)";
         on = true;
      } else {
         logo.style.color = "rgba(255, 255, 255, 0.25)";
         on = false;
      }
      if (counter < 2 * times) {
         counter++;
         setTimeout(function() { flashLogo(times); }, 50);
      } else {
         counter = 1;
      }
   }
})();

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
   //console.log(this.totalLinesCleared);
};

Game.prototype.tick = function() {
   this.lowerBlock();
   this.renderBoard();
};

Game.prototype.userDropBlock = function() {
   var levels = this.getLevels();

   var minLevel = levels[0];
   for (var k = 1; k < levels.length; k++)
      if (levels[k] < minLevel)
         minLevel = levels[k];
   //console.log(minLevel);

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
};

// Called both on tick and on user down move
Game.prototype.lowerBlock = function() {
   var levels = this.getLevels();
   if (levels.indexOf(0) == -1) {  // Block can move down (at least) one step
      this.currBlock.coords = this.currBlock.coords.map(function(coord) {
         return coord.plus(new Coord(1, 0));
      });
   } else {
      // Block can go no further down; put it into the grid and spawn
      // a new block.
      var self = this;
      this.currBlock.coords.forEach(function(coord) {
         self.grid[coord.y][coord.x] = self.currBlock.type;
      });
      this.packGrid();
      this.spawnBlock();
   }
   this.renderBoard();

};

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
};

Game.prototype.userRotateBlock = function() {
   var rotationData = this.currBlock.getNextRotation();
   if (this.checkCollision(rotationData.coords)) {
      this.currBlock.coords = rotationData.coords;
      this.currBlock.rotation = rotationData.rotation;
      this.renderBoard();
   }
};

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
};

Game.prototype.getLevels = function() {
   var levels = [];
   for (var k = 0; k < this.currBlock.coords.length; k++) {
      var coord = this.currBlock.coords[k];

      var level = 0;
      while (coord.y + level + 1 < this.grid.length &&
             this.grid[coord.y + level + 1][coord.x] == null)
         level++;
      levels.push(level);
   }
   return levels;
};

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
};

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
      "1": [new Coord(0,1), new Coord(1,1), new Coord(2,1), new Coord(2,2)],
      "2": [new Coord(0,2), new Coord(1,0), new Coord(1,1), new Coord(1,2)],
      "3": [new Coord(0,0), new Coord(0,1), new Coord(1,1), new Coord(2,1)]
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
};

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

// Initialize Firebase
var config = {
 apiKey: "AIzaSyBQrebUmCqmy4r1dYGpDOf6-kmgf8M2K-w",
 authDomain: "quadrix-639de.firebaseapp.com",
 databaseURL: "https://quadrix-639de.firebaseio.com",
 projectId: "quadrix-639de",
 storageBucket: "quadrix-639de.appspot.com",
 messagingSenderId: "1058568698217"
};
firebase.initializeApp(config);
var db = firebase.database();

// Main controller
function Quadrix(rootNode) {
   this.rootNode = rootNode;
   this.gameStatus = "stopped";
   this.gameTimer = 0;
   this.tickRate = Quadrix.getTickRate(0);
   this.game = new Game(21, 10, 0, this, null, rootNode);

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
            // Ugly way to handle the option of having down-arrow drop block;
            // I will redo this later.
            if (self.options.downDrop)
               self.game.userDropBlock();
            else
               self.game.userMoveBlock("down");
            break;
         case 80:  // 'P'
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

   this.highScores = [];
   this.setGrid(true);
   // Setup listener to Firebase "highScores" collection. Each time
   // the collection is updated, this.loadHighScores gets called.
   db.ref("highScores").on("value", this.loadHighScores.bind(this));
   this.loadData = true;
}

Quadrix.prototype.newGame = function() {
   this.rootNode.removeChild(this.rootNode.firstChild);

   var startLevel = Number(document.getElementById("options-level").value);
   this.game = new Game(21, 10, startLevel, this, this.callbackHandlers,
         this.rootNode);
   this.game.spawnBlock();
   this.game.renderBoard();

   var previewNode = document.getElementById("preview-container");
   if (previewNode.firstChild)
      previewNode.removeChild(previewNode.firstChild);
   previewNode.appendChild(this.game.blockPreview);

   document.getElementById("score").textContent = "Score: 0";
   document.getElementById("level").textContent = "Level: " + startLevel;

   this.tickRate = Quadrix.getTickRate(startLevel);
   var self = this;
   this.gameTimer = setInterval(function() {
      self.game.tick();
   }, this.tickRate);

   this.setGrid(this.options.grid);
   addEventListener("keydown", this.handleGameInput);
   this.gameStatus = "running";
};

Quadrix.prototype.pauseGame = function() {
   clearInterval(this.gameTimer);
   removeEventListener("keydown", this.handleGameInput);
   actionButton.textContent = "Resume";
   this.gameStatus = "paused";
};

Quadrix.prototype.resumeGame = function() {
   var self = this;
   this.gameTimer = setInterval(function() {
      self.game.tick();
   }, this.tickRate);

   addEventListener("keydown", this.handleGameInput);
   this.gameStatus = "running";
};

// Passed as a callback to Game, executed on game over
Quadrix.prototype.stopGame = function(finalScore, finalLevel) {
   clearInterval(this.gameTimer);
   removeEventListener("keydown", this.handleGameInput);
   document.getElementById("action").textContent = "New game";
   this.gameStatus = "stopped";

   this.evaluateGame(finalScore, finalLevel);
   // TODO: hide preview box, possibly update high score
};

Quadrix.prototype.handleScoreUpdate = function(score) {
   document.getElementById("score").textContent = "Score: " + score;
};

Quadrix.prototype.handleLevelUpdate = function(level) {
   clearInterval(this.gameTimer);
   this.tickRate = Quadrix.getTickRate(level);
   var self = this;
   this.gameTimer = setInterval(function() {
      self.game.tick();
   }, this.tickRate);

   document.getElementById("level").textContent = "Level: " + level;
};

Quadrix.prototype.setGrid = function(value) {
   var gameCells = document.querySelectorAll("#gameTable td");
   if (value) {
      for (var k = 0; k < gameCells.length; k++)
         gameCells[k].style.border = "1px solid rgb(20,20,20)";
      this.options.grid = true;
   } else {
      for (var k = 0; k < gameCells.length; k++)
         gameCells[k].style.border = "1px solid rgb(0,0,0)";
      this.options.grid = false;
   }
}

Quadrix.getTickRate = function(level) {
   if (level <= 6)
      return 600 - 70 * level;
   else if (7 <= level && level <= 9)
      return 140 - 20 * (level - 7);
   else
      return Math.max(100 - 10 * (level - 9), 50);
};

Quadrix.prototype.options = {
   downDrop: false,
   grid: true,
};

Quadrix.prototype.evaluateGame = function(score, level) {
   if (score == 0)
      return;
   var lastEntry = this.highScores[this.highScores.length - 1];
   // (lastEntry might be undefined here, which is OK.)
   if (this.highScores.length < 10 || score > lastEntry.score ||
      (score == lastEntry.score && level > lastEntry.level))
   {
      this.score = score;
      this.level = level;
      document.getElementById("name-modal").style.visibility = "visible";
      var input = document.querySelector("#name-modal input");
      input.focus();
      input.select();
   }
}

Quadrix.prototype.saveHighScore = function(name) {
   var entry = {
      name: name,
      score: this.score,
      level: this.level,
      date: new Date().getTime()
   };

   var scoreRef = db.ref("highScores").push();
   if (this.highScores.length == 10) {
      var _id = this.highScores[this.highScores.length - 1]._id;
      // Firebase fires callback on both remove() and push(), so to prevent
      // rebuilding the display data on remove() we use a loadData flag:
      this.loadData = false;
      var self = this;
      db.ref("highScores/" + _id).remove(function() {
         self.loadData = true;
         scoreRef.set(entry);
      });
   } else {
      scoreRef.set(entry);
   }
   document.getElementById("name-modal").style.visibility = "hidden";
   document.getElementById("hs-modal").style.visibility = "visible";
}

// Called by Firebase each time the database is updated in some way
Quadrix.prototype.loadHighScores = function(snapshot) {
   if (!this.loadData)
      return;
   this.highScores = [];
   var data = snapshot.val();
   for (key in data) {  // Here key is the ID of the entry
      var entry = data[key];
      entry.date = new Date(entry.date).toISOString().substr(0, 10);
      entry._id = key;
      this.highScores.push(entry);
   }
   this.renderHighScores();
}

Quadrix.prototype.renderHighScores = function() {
   var tableBody = document.getElementById("hs-table-body");
   while (tableBody.firstChild)
      tableBody.removeChild(tableBody.firstChild);

   this.highScores.sort(function(a, b) {
      if (a.score > b.score) return -1;
      if (a.score < b.score) return 1;
      if (a.level > b.level) return -1;
      if (a.level < b.level) return 1;
      if (a.name.toLowerCase() < b.name.toLowerCase()) return -1;
      if (a.name.toLowerCase() > b.name.toLowerCase()) return 1;
      return 0;
   });

   var appendCell = function(entry, row, key, width) {
      var cell = document.createElement("td");
      cell.textContent = entry[key];
      cell.style.width = width;
      row.appendChild(cell);
   };

   for (var k = 0; k < 10; k++) {
      var row = document.createElement("tr");
      var placementCell = document.createElement("td");
      placementCell.textContent = k + 1;
      placementCell.style.textAlign = "right";
      row.appendChild(placementCell);
      tableBody.appendChild(row);
      if (k >= this.highScores.length)
         continue;

      // Hard-coding this to get the ordering of the cells correct.
      // (There is no guarantee of ordering in an object, so a for...in
      // loop won't work smoothly.)
      appendCell(this.highScores[k], row, "name", "40%");
      appendCell(this.highScores[k], row, "score", "15%");
      appendCell(this.highScores[k], row, "level", "15%");
      appendCell(this.highScores[k], row, "date", "25%");
   }
}

//------------------------------------------------------------------------------

var quadrix = new Quadrix(document.getElementById("root"));

// Setup interface event handlers ----------------------------------------------

var actionButton = document.getElementById("action");
actionButton.addEventListener("click", function() {
   if (quadrix.gameStatus == "stopped") {
      quadrix.newGame();
      actionButton.textContent = "Pause";
   } else if (quadrix.gameStatus == "running") {
      quadrix.pauseGame();
   } else if (quadrix.gameStatus == "paused") {
      quadrix.resumeGame();
      actionButton.textContent = "Pause";
   }
});

var optionsModal = document.getElementById("options-modal");
document.getElementById("options").addEventListener("click", function(event) {
   optionsModal.style.visibility = optionsModal.style.visibility == "visible" ?
                                   "hidden" : "visible";
   event.stopPropagation();
});
// For hiding the Options modal
addEventListener("click", function(event) {
   if (event.target.id.indexOf("options-") != -1)
      return;
   if (optionsModal.style.visibility == "visible")
      optionsModal.style.visibility = "hidden";
});

document.getElementById("options-grid").addEventListener("click", function() {
   if (quadrix.options.grid) {
      quadrix.setGrid(false);
   } else {
      quadrix.setGrid(true);
   }
});

document.getElementById("options-downdrop")
        .addEventListener("click", function(event) {
   quadrix.options.downDrop = !quadrix.options.downDrop;
});

var highScoresModal = document.getElementById("hs-modal");
document.getElementById("high-scores").addEventListener("click", function(event) {
   highScoresModal.style.visibility = highScoresModal.style.visibility == "visible" ?
                                      "hidden" : "visible";
   event.stopPropagation();
});
addEventListener("click", function(event) {
   if (highScoresModal.style.visibility == "visible")
      highScoresModal.style.visibility = "hidden";
});

document.querySelector("#name-modal input")
        .addEventListener("keydown", function(event) {
   if (event.target.value.length > 0 && event.keyCode == 13)
      quadrix.saveHighScore(event.target.value);
});

window.addEventListener("keydown", function(e) { // TODO: remove
   if (e.keyCode == 36)
      console.log(quadrix.highScores);
})