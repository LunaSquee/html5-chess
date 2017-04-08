(function ($) {
  let Chess = {
    DOM: {},
    Game: {
      gameId: null,
      turn: 'white',
      pieces: [],
      whiteCaptures: [],
      blackCaptures: [],
      whiteChecked: false,
      blackChecked: false,
      moveHistory: []
    },
    pieces: [
      'king', 'queen', 'rook', 'bishop', 'knight', 'pawn'
    ],
    arrangement: ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'],
    piecesImageDB: {black: {}, white: {}}
  }

  // TODO LIST
  // Special moves: castling, En passant, Pawn promotion
  // End of game (checkmate)

  window.requestAnimFrame = (function() {
    return window.requestAnimationFrame       ||
           window.webkitRequestAnimationFrame ||
           window.mozRequestAnimationFrame    ||
           function (callback) {
             window.setTimeout(callback, 1000 / 60)
           }
  })()

  function mustacheTempl (tmlTag, data) {
    let html = ''
    const tag = document.querySelector('#' + tmlTag)

    if (!tag) return ''
    html = tag.innerHTML
    html = window.Mustache.to_html(html, data)
    return html
  }

  function pointerOnCanvas (e) {
    let x
    let y

    if (e.changedTouches) {
      let touch = e.changedTouches[0]
      if (touch) {
        e.pageX = touch.pageX
        e.pageY = touch.pageY
      }
    }

    if (e.pageX || e.pageY) { 
      x = e.pageX
      y = e.pageY
    } else {
      x = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft
      y = e.clientY + document.body.scrollTop + document.documentElement.scrollTop
    }

    x -= Chess.DOM.canvas.offsetLeft
    y -= Chess.DOM.canvas.offsetTop

    return {x: x, y: y}
  }

  let ChessLogic = {
    getPieceAt: (x, y) => {
      let result = null
      for (let i in Chess.Game.pieces) {
        let piece = Chess.Game.pieces[i]
        if (piece.x === x && piece.y === y) {
          result = piece
          break
        }
      }
      return result
    },

    diagonalPath: (x, y, direction, amount, turnColor, pathOnKingToo) => {
      let path = []
      let xAt = x
      let yAt = y
      let hitTile = false
      for (let i = 0; i < amount; i++) {

        if (direction === 0) {
          xAt -= 1
          yAt += 1
        } else if (direction === 1) {
          yAt += 1
          xAt += 1
        } else if (direction === 2) {
          yAt -= 1
          xAt -= 1
        } else if (direction === 3) {
          yAt -= 1
          xAt += 1
        }

        if (xAt < 1 || xAt > 8) break
        if (yAt < 1 || yAt > 8) break
        if (hitTile) break

        let tileAt = ChessLogic.getPieceAt(xAt, yAt)
        if (ChessLogic.colorCanMoveTo(xAt, yAt, turnColor, pathOnKingToo) && !hitTile) {
          hitTile = (tileAt != null ? tileAt.color != turnColor : false)
          path.push([xAt, yAt, ChessLogic.getPieceAt(x, y)])
        } else {
          hitTile = tileAt != null
        }
      }
      return path
    },

    axialPath: (x, y, direction, amount, turnColor, pathOnKingToo) => {
      let path = []
      let xAt = x
      let yAt = y
      let hitTile = false
      for (let i = 0; i < amount; i++) {
        if (direction === 0) {
          yAt += 1
        } else if (direction === 1) {
          xAt -= 1
        } else if (direction === 2) {
          yAt -= 1
        } else if (direction === 3) {
          xAt += 1
        }

        if (xAt < 1 || xAt > 8) break
        if (yAt < 1 || yAt > 8) break
        if (hitTile) break

        let tileAt = ChessLogic.getPieceAt(xAt, yAt)
        if (ChessLogic.colorCanMoveTo(xAt, yAt, turnColor, pathOnKingToo) && !hitTile) {
          hitTile = (tileAt != null ? tileAt.color != turnColor : false)
          path.push([xAt, yAt, ChessLogic.getPieceAt(x, y)])
        } else {
          hitTile = tileAt != null
        }
      }
      return path
    },

    roundPath: (x, y, color, pathOnKingToo) => {
      let path = []
      path.push([x - 1, y - 1])
      path.push([x, y - 1])
      path.push([x + 1, y - 1])
      path.push([x - 1, y])
      path.push([x + 1, y])
      path.push([x - 1, y + 1])
      path.push([x, y + 1])
      path.push([x + 1, y + 1])

      let actualPath = []

      for (let i in path) {
        let p = path[i]
        let canMove = ChessLogic.colorCanMoveTo(p[0], p[1], color, pathOnKingToo)
        if (canMove) {
          p[2] = ChessLogic.getPieceAt(x, y)
          actualPath.push(p)
        }
      }

      return actualPath
    },

    colorCanMoveTo: (x, y, color, pathOnKingToo) => {
      let canMove = false
      if (x < 1 || y < 1 || x > 8 || y > 8) return false

      let pieceAt = ChessLogic.getPieceAt(x, y)
      if (pieceAt) {
        if (pieceAt.color !== color) {
          canMove = true
          if (!pathOnKingToo && pieceAt.name === 'king') {
            canMove = false
          }
        }
      } else {
        canMove = true
      }

      return canMove
    },

    paths: {
      pawn: (x, y, color, firstMove, turnColor, pathOnKingToo) => {
        let paths = []
        let dir = 2
        if (color === 'black') dir = 0
        let data = ChessLogic.axialPath(x, y, dir, firstMove ? 2 : 1, turnColor, pathOnKingToo)
        paths = paths.concat(data)

        if (paths.length === 1 && !firstMove) {
          let zPath = [paths[0][0], paths[0][1]]
          let tileAtUpPoint = ChessLogic.getPieceAt(zPath[0], zPath[1])
          if (tileAtUpPoint) {
            paths.splice(0, 1)
          }

          for (let i = 0; i < 2; i++) {
            let tileAt = ChessLogic.getPieceAt(zPath[0] + (i === 0 ? -1 : 1), zPath[1])
            if (tileAt && tileAt.color !== color) {
              paths.push([tileAt.x, tileAt.y, ChessLogic.getPieceAt(x, y)])
            }
          }
        } else if (paths.length === 2 && firstMove) {
          let xPath = [paths[1][0], paths[1][1]]
          let tileAt = ChessLogic.getPieceAt(xPath[0], xPath[1])
          if (tileAt) {
            paths.splice(1, 1)
          }
        }

        return paths
      },
      knight: (x, y, color, first, turnColor, pathOnKingToo) => {
        let paths = []
        for (let i = 0; i < 8; i++) {
          let xAt = x
          let yAt = y
          if (i == 0) {
            xAt -= 1
            yAt -= 2
          } else if (i == 1) {
            xAt += 1
            yAt -= 2
          } else if (i == 2) {
            xAt += 2
            yAt -= 1
          } else if (i == 3) {
            xAt += 2
            yAt += 1
          } else if (i == 4) {
            yAt += 2
            xAt += 1
          } else if (i == 5) {
            yAt += 2
            xAt -= 1
          } else if (i == 6) {
            xAt -= 2
            yAt -= 1
          } else if (i == 7) {
            xAt -= 2
            yAt += 1
          }

          let canMove = ChessLogic.colorCanMoveTo(xAt, yAt, color, pathOnKingToo)
          if (canMove) {
            paths.push([xAt, yAt, ChessLogic.getPieceAt(x, y)])
          }
        }
        return paths
      },
      bishop: (x, y, color, first, turnColor, pathOnKingToo) => {
        let paths = []
        for (let i = 0; i < 4; i++) {
          paths = paths.concat(ChessLogic.diagonalPath(x, y, parseInt(i), 8, turnColor, pathOnKingToo))
        }
        return paths
      },
      rook: (x, y, color, first, turnColor, pathOnKingToo) => {
        let paths = []
        for (let i = 0; i < 4; i++) {
          paths = paths.concat(ChessLogic.axialPath(x, y, parseInt(i), 8, turnColor, pathOnKingToo))
        }
        return paths
      },
      king: (x, y, color, first, turnColor, pathOnKingToo) => {
        return ChessLogic.roundPath(x, y, color, pathOnKingToo)
      },
      queen: (x, y, color, first, turnColor, pathOnKingToo) => {
        let paths = []
        for (let i = 0; i < 4; i++) {
          paths = paths.concat(ChessLogic.diagonalPath(x, y, parseInt(i), 8, turnColor, pathOnKingToo))
        }
        for (let i = 0; i < 4; i++) {
          paths = paths.concat(ChessLogic.axialPath(x, y, parseInt(i), 8, turnColor, pathOnKingToo))
        }
        return paths
      }
    },

    generatePaths: (tileSpec, turnColor, pathOnKingToo) => {
      let paths = []
      if (ChessLogic.paths[tileSpec.name]) {
        paths = paths.concat(ChessLogic.paths[tileSpec.name](tileSpec.x, tileSpec.y, tileSpec.color, 
          (tileSpec.first != null ? tileSpec.first : null), turnColor, pathOnKingToo))
      }
      return paths
    },

    getKing: (color) => {
      let king = null
      for (let i in Chess.Game.pieces) {
        let tile = Chess.Game.pieces[i]
        if (tile.name === 'king' && tile.color === color) {
          king = tile
        }
      }
      return king
    },

    opponentCanTakeOutPiece: (piece) => {
      let paths = []
      let piecesThatCanTakeOut = []

      for (let i in Chess.Game.pieces) {
        let p = Chess.Game.pieces[i]
        if (p.color !== piece.color) {
          paths = paths.concat(ChessLogic.generatePaths(p, p.color, true))
        }
      }

      for (let i in paths) {
        let path = paths[i]
        if (path[0] === piece.x && path[1] === piece.y) {
          piecesThatCanTakeOut.push(path[2])
        }
      }
      return piecesThatCanTakeOut
    },

    checkCheckOnColor: (color) => {
      let king = ChessLogic.getKing(color)
      let checkedBy = ChessLogic.opponentCanTakeOutPiece(king)

      return checkedBy
    },

    checkmateCheck: (color, checkingPieces) => {
      return false // TODO: checkmate check
      /*
        king must not be
          able to move away from the check
          able to be obstructed by a piece of same color
          able to do castling
          able to capture the checking piece
          able to get help (other piece of same color captures the checking piece)
        to count as checkmated
      */

      let king = ChessLogic.getKing(color)
      let pathsKing = ChessLogic.generatePaths(king, color, false)
      let kingEscapeRoutes = []

      let opposingPaths = []

      for (let i in Chess.Game.pieces) {
        let p = Chess.Game.pieces[i]
        opposingPaths = opposingPaths.concat(ChessLogic.generatePaths(p, p.color, false))
      }

      for (let i in opposingPaths) {
        let path = opposingPaths[i]
        for (let j in pathsKing) {
          let pathKing = pathsKing[j]
          if (path[0] !== pathKing[0] && path[1] === pathKing[1]) {
            kingEscapeRoutes.push(pathKing)
          }
        }
      }

      if (kingEscapeRoutes.length) {
        return false
      }

    }
  }

  function opposingColor (color) {
    let col = 'black'
    if (color === 'black') {
      col = 'white'
    }
    return col
  }

  function moveName (x, y) {
    let dx = 'abcdefgh'[parseInt(x-1)]
    let dy = 9 - y
    return {
      x: x,
      y: y,
      rank: dx,
      file: dy,
      toString: () => {
        return dx+''+dy
      }
    }
  }

  function historyPush (data) {
    Chess.Game.moveHistory.push(data)
    Chess.DOM.history.innerHTML += '<div class="move t_' + data.color + '">' + moveName(data.x, data.y).toString() + '</div>'
  }

  let GameLogic = {
    tile: 84,
    offset: 42,

    by: 0,
    bx: 0,

    tileX: 0,
    tileY: 0,

    mouseon: false,

    moveAbleTiles: [],
    currentlySelected: null,

    getCaptureAt: (piece) => {
      for (let i in Chess.Game.pieces) {
        let pa = Chess.Game.pieces[i]
        if (pa.x === piece.x && pa.y === piece.y && pa.color !== piece.color) {
          Chess.Game[Chess.Game.turn + 'Captures'].push(pa)
          Chess.Game.pieces.splice(parseInt(i), 1)
          // Chess.Game.turn + ' captured a ' + pa.color + ' ' + pa.name
          
          let dom = Chess.DOM[Chess.Game.turn + 'Caps']
          dom.innerHTML += '<div class="cap c_' + pa.name + ' t_' + pa.color + '">'+
                           '<img src="' + Chess.piecesImageDB[pa.color][pa.name].src + '"></div>'
        }
      }
    },

    deselectAndSwitch: () => {
      GameLogic.currentlySelected = null
      GameLogic.moveAbleTiles = []

      Chess.Game.turn = opposingColor(Chess.Game.turn)

      let checks = ChessLogic.checkCheckOnColor(Chess.Game.turn)

      if (checks.length) {
        console.log(checks)
        alert('Your king is checked!')
        let checkmate = ChessLogic.checkmateCheck(Chess.Game.turn, checks)
        if (checkmate) {
          alert('Checkmate!')
        } 
      }
    },

    moveTileAt: (x, y, nx, ny) => {
      for (let i in Chess.Game.pieces) {
        let tile = ChessLogic.getPieceAt(x, y)
        let tileAtEnd = ChessLogic.getPieceAt(nx, ny)
        if (!tile) continue
        if (ChessLogic.colorCanMoveTo(nx, ny, Chess.Game.turn)) {
          if (tileAtEnd && tileAtEnd.name === 'king') return
          tile.x = nx
          tile.y = ny

          if (tile.first != null && tile.first === true) {
            tile.first = false
          }
          
          historyPush({color: Chess.Game.turn, x: nx, y: ny, name: tile.name})

          GameLogic.getCaptureAt(tile)
          GameLogic.deselectAndSwitch()
        }
      }
    },

    tryMoveTo: (tile, x, y) => {
      let movePos = null

      for (let i in GameLogic.moveAbleTiles) {
        let a = GameLogic.moveAbleTiles[i]
        if (a[0] === x && a[1] === y) {
          movePos = a
        }
      }

      if (movePos) {
        GameLogic.moveTileAt(tile.x, tile.y, movePos[0], movePos[1])
      }
    },

    click: () => {
      if (!GameLogic.currentlySelected) {
        let turnColor = Chess.Game.turn
        let pieceAt = ChessLogic.getPieceAt(GameLogic.tileX, GameLogic.tileY)
        if (pieceAt && pieceAt.color === turnColor) {
          GameLogic.currentlySelected = pieceAt
          GameLogic.moveAbleTiles = ChessLogic.generatePaths(pieceAt, turnColor, false)
        }
      } else {
        if (GameLogic.tileX === GameLogic.currentlySelected.x && GameLogic.tileY === GameLogic.currentlySelected.y) {
          GameLogic.currentlySelected = null
          GameLogic.moveAbleTiles = []
          return
        }
        GameLogic.tryMoveTo(GameLogic.currentlySelected, GameLogic.tileX, GameLogic.tileY)
      }
    },

    fetchPieces: () => {
      for (let i in Chess.pieces) {
        for (let j = 0; j < 2; j++) {
          let name = Chess.pieces[i]
          let img = new Image()
          let group = (j == 0 ? 'white' : 'black')

          img.src = './svg/' + name + '_' + group + '.svg'

          img.onload = () => {
            Chess.piecesImageDB[group][name] = img
            if (parseInt(i) + j == 6) {
              GameLogic.arrangePieces()
            }
          }
        }
      }
    },

    arrangePieces: () => {
      for (let rev = 0; rev < 2; rev++) {
        let color = (rev === 0 ? 'black' : 'white')
        let offset = (rev === 0 ? 0 : 6)
        let arrangementFirst = (rev === 0)
        for(let i = 0; i < 8; i++) {
          if (arrangementFirst) {
            let atThisLocation = Chess.arrangement[i]
            Chess.Game.pieces.push({name: atThisLocation, x: i + 1, y: offset + 1, color: color, first: true})
          }

          let atThisLocation = Chess.arrangement[i]
          Chess.Game.pieces.push({name: 'pawn', x: i + 1, y: offset + (arrangementFirst ? 2 : 1), color: color, first: true})

          if (!arrangementFirst) {
            let atThisLocation = Chess.arrangement[i]
            Chess.Game.pieces.push({name: atThisLocation, x: i + 1, y: offset + 2, color: color, first: true})
          }
        }
      }
      GameLogic.drawGrid()
    },

    drawGrid: () => {
      let dark = false

      for (let i = 0; i < 8; i++) {
        Chess.ctx.font = '32px Open Sans'
        Chess.ctx.fillStyle = '#964d00'
        Chess.ctx.strokeText('abcdefgh'[i], (i * GameLogic.tile) + GameLogic.tile - 10, 26)
        Chess.ctx.strokeText('87654321'[i], 14, (i * GameLogic.tile) + GameLogic.tile + 10)
        dark = !dark
        for (let j = 0; j < 8; j++) {
          dark = !dark

          if (dark) {
            Chess.ctx.fillStyle = '#964d00'
          } else {
            Chess.ctx.fillStyle = '#dd7200'
          }

          Chess.ctx.fillRect((GameLogic.tile * i) + GameLogic.offset, (GameLogic.tile * j) + GameLogic.offset,
            GameLogic.tile, GameLogic.tile)
        }
      }

      GameLogic.staticState = new Image()
      GameLogic.staticState.src = Chess.DOM.canvas.toDataURL()
      GameLogic.staticState.onload = () => {
        GameLogic.gameLoop()
      }
    },

    listenToInputs: () => {
      Chess.DOM.canvas.addEventListener('mousemove', (e) => {
        let coords = pointerOnCanvas(e)

        if (coords.x > GameLogic.offset && coords.y > GameLogic.offset) {
          let tileX = Math.floor((coords.x + GameLogic.offset) / GameLogic.tile)
          let tileY = Math.floor((coords.y + GameLogic.offset) / GameLogic.tile)

          if (tileX <= 8 && tileY <= 8) {
            GameLogic.mouseon = true
            GameLogic.tileX = tileX
            GameLogic.tileY = tileY
          } else {
            GameLogic.mouseon = false
          }
        } else {
          GameLogic.mouseon = false
        }
      })

      Chess.DOM.canvas.addEventListener('mouseleave', (e) => {
        GameLogic.mouseon = false
      })

      Chess.DOM.canvas.addEventListener('click', (e) => {
        GameLogic.click()
      })
    },

    getAbsoluteDrawCoords: (x, y) => {
      return {
        x: ((x - 1) * GameLogic.tile) + GameLogic.offset,
        y: ((y - 1) * GameLogic.tile) + GameLogic.offset
      }
    },

    drawFrame: () => {
      if (GameLogic.mouseon) {
        let drawCoords = GameLogic.getAbsoluteDrawCoords(GameLogic.tileX, GameLogic.tileY)
        Chess.ctx.globalAlpha = 0.2
        Chess.ctx.fillStyle = '#eae027'
        Chess.ctx.fillRect(drawCoords.x, drawCoords.y, GameLogic.tile, GameLogic.tile)
        Chess.ctx.globalAlpha = 1.0
      }

      if (GameLogic.currentlySelected) {
        let drawCoords = GameLogic.getAbsoluteDrawCoords(GameLogic.currentlySelected.x, GameLogic.currentlySelected.y)
        Chess.ctx.globalAlpha = 0.5
        Chess.ctx.fillStyle = '#c4c4c4'
        Chess.ctx.fillRect(
          drawCoords.x,
          drawCoords.y, 
          GameLogic.tile, 
          GameLogic.tile
        )
        for (let i in GameLogic.moveAbleTiles) {
          let tile = GameLogic.moveAbleTiles[i]
          let dc = GameLogic.getAbsoluteDrawCoords(tile[0], tile[1])
          Chess.ctx.fillRect(
            dc.x, dc.y,
            GameLogic.tile, 
            GameLogic.tile
          )
        }
        Chess.ctx.globalAlpha = 1.0
      }

      for (let i in Chess.Game.pieces) {
        let at = Chess.Game.pieces[i]
        let color = at.color
        let image = Chess.piecesImageDB[color][at.name]

        Chess.ctx.drawImage(image, 
          (at.x * GameLogic.tile) - GameLogic.offset, 
          (at.y * GameLogic.tile) - GameLogic.offset,
          GameLogic.tile, GameLogic.tile)
      }
    },

    clear: () => {
      Chess.ctx.clearRect(0, 0, Chess.DOM.canvas.width, Chess.DOM.canvas.height)
      Chess.ctx.drawImage(GameLogic.staticState, 0, 0)
    },

    gameLoop: () => {
      GameLogic.clear()
      GameLogic.drawFrame()
      requestAnimFrame(GameLogic.gameLoop)
    },

    start: () => {
      GameLogic.fetchPieces()
      GameLogic.listenToInputs()
    }
  }

  window.onload = () => {
    const gameScreen = Chess.DOM.gameScreen = $.querySelector('#game')
    const canvas = Chess.DOM.canvas = $.querySelector('#game_canvas')

    const turn = Chess.DOM.turn = gameScreen.querySelector('#turn')
    const whiteCaps = Chess.DOM.whiteCaps = gameScreen.querySelector('#caps_white')
    const blackCaps = Chess.DOM.blackCaps = gameScreen.querySelector('#caps_black')
    const history = Chess.DOM.history = gameScreen.querySelector('#history')

    Chess.ctx = canvas.getContext('2d')

    GameLogic.start()
  }
})(document)
