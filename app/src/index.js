import 'bootstrap/dist/css/bootstrap.min.css';
import './css/custom.css';
import 'bootstrap/dist/js/bootstrap.min.js';
import './js/validations.js';
const Web3 = require("web3");
const TruffleContract = require("truffle-contract");
const $ = require("jquery");
// Our built contract
const rockPaperScissorsJSON = require("../../build/contracts/RockPaperScissors.json");

const App = {
  web3: null,
  account: null,
  RockPaperScissors: null,

  initWeb3: function () {
    if (window.ethereum) {
      web3 = new Web3(window.ethereum);
      window.ethereum.enable(); // get permission to access accounts
    } else {
      console.warn(
        "No web3 detected. Falling back to http://127.0.0.1:7545.",
      );
      web3 = new Web3(
        new Web3.providers.HttpProvider("http://127.0.0.1:7545"),
      );
    }
    return this.initContract();
  },

  initContract: async function () {
    try {
      this.RockPaperScissors = TruffleContract(rockPaperScissorsJSON);
      this.RockPaperScissors.setProvider(web3.givenProvider);

      this.currentAccount();
      this.checkActivity();
      this.updateBalanceContract();
      this.updateLogPlayerOneMove();
      this.updateLogPlayerTwoMove();
      this.updateLogShowMoveOne();
      this.updateLogWinner();
      this.updateLogDraw();
      this.updateLogClaimNoGame();
      this.updateLogClaimMoveOneNotShown();
      this.updateLogWithdrawn();
      this.bindEvents();
    } catch (error) {
      console.error("Could not connect to contract or chain.");
    }
  },

  bindEvents: function () {
    $(document).on('click', '#hashIt', App.hashIt);
    $(document).on('click', '#playerOneMove', App.playerOneMove);
    $(document).on('click', '#playerTwoMove', App.playerTwoMove);
    $(document).on('click', '#showMoveOne', App.showMoveOne);
    $(document).on('click', '#claimNoGame', App.claimNoGame);
    $(document).on('click', '#claimMoveOneNotShown', App.claimMoveOneNotShown);
    $(document).on('click', '#withdraw', App.withdraw);
    $(document).on('click', '#pauseResume', App.pauseResume);
  },

  currentAccount: async function () {
    const accounts = await web3.eth.getAccounts();
    App.account = accounts[0];
    App.checkAdmin();
    document.getElementById("yourAddress").innerHTML = App.account;
    App.updateBalanceSender();
    // App.updateBalanceFees();
    window.ethereum.on('accountsChanged', function (accounts) {
      // Update fields
      App.account = accounts[0];
      document.getElementById("yourAddress").innerHTML = App.account;
      App.updateBalanceSender();
      // App.updateBalanceFees();
      App.checkAdmin();
    })
  },

  checkAdmin: function () {
    var rpsInstance;
    App.RockPaperScissors.deployed().then(function (instance) {
      rpsInstance = instance;
      return rpsInstance.isOwner({from: App.account})
    }).then(function (admin) {
      if (admin) {
        document.getElementById("buttonAdmin").setAttribute("style", "display:true");
      } else {
        document.getElementById("buttonAdmin").setAttribute("style", "display:none");
      }
    }).catch(function (err) {
      console.log(err);
    });
  },

  checkActivity: function () {
    var rpsInstance;
    App.RockPaperScissors.deployed().then(function (instance) {
      rpsInstance = instance;
      return rpsInstance.isKilled()
    }).then(function (isKilled) {
      if (isKilled) {
        $("#activity").empty();
        $("#activity").append(`<span class="badge badge-pill badge-danger">contract is dead</span>`);
        $("#adminButtons").empty();
        $("#adminButtons").append(`<button class="dropdown-item btn btn-success" type="button" id="emergencyWithdraw">Withdraw all the funds from the contract</button>
          `);
        document.getElementById('hashIt').disabled = true;
        document.getElementById('playerOneMove').disabled = true;
        document.getElementById('playerTwoMove').disabled = true;
        document.getElementById('showMoveOne').disabled = true;
        document.getElementById('claimNoGame').disabled = true;
        document.getElementById('claimMoveOneNotShown').disabled = true;
        document.getElementById('withdraw').disabled = true;
        document.getElementById('emergencyWithdraw').addEventListener('click', function (event) {
          App.emergencyWithdraw();
        });
      } else {
        return rpsInstance.isPaused().then(function (isPaused) {
          if (isPaused == true) {
            $("#activity").empty();
            $("#activity").append(`<span class="badge badge-pill badge-warning">contract in pause</span>`);
            $("#adminButtons").empty();
            $("#adminButtons").append(`<button class="dropdown-item btn btn-success" type="button" id="pauseResume">Activate the contract</button>
          <button class="dropdown-item btn btn-danger" type="button" id="kill" onclick="App.kill()">Kill the Contract</button>
          `);
            document.getElementById('hashIt').disabled = true;
            document.getElementById('playerOneMove').disabled = true;
            document.getElementById('playerTwoMove').disabled = true;
            document.getElementById('showMoveOne').disabled = true;
            document.getElementById('claimNoGame').disabled = true;
            document.getElementById('claimMoveOneNotShown').disabled = true;
            document.getElementById('withdraw').disabled = true;
            document.getElementById('kill').addEventListener('click', function (event) {
              App.kill();
            });
          } else {
            $("#activity").empty();
            $("#activity").append(`<span class="badge badge-pill badge-success">contract active</span>`);
            $("#adminButtons").empty();
            $("#adminButtons").append(`<button class="dropdown-item btn btn-warning" type="button" id="pauseResume">Pause the contract</button>`);
            document.getElementById('hashIt').disabled = false;
            document.getElementById('playerOneMove').disabled = false;
            document.getElementById('playerTwoMove').disabled = false;
            document.getElementById('showMoveOne').disabled = false;
            document.getElementById('claimNoGame').disabled = false;
            document.getElementById('claimMoveOneNotShown').disabled = false;
            document.getElementById('withdraw').disabled = false;
            document.getElementById('claimNoGame').disabled = false;
          }
          document.getElementById('pauseResume').addEventListener('click', function (event) {
            App.pauseResume();
          });
        }).catch(function (err) {
          console.log(err);
        });
      }
    }).catch(function () {});
  },

  pauseResume: async function () {
    $(".spinnerCube").empty();
    $("#txStatusUp").empty();
    cubeSpinner('#txStatusUp');
    var rpsInstance;
    App.RockPaperScissors.deployed().then(function (instance) {
      rpsInstance = instance;
      return rpsInstance.isPaused()
    }).then(async function (isPaused) {
      if (isPaused) {
        const success = await rpsInstance.resume.call({
          from: App.account
        })
        if (!success) {
          $("#txStatusUp").empty();
          $(".spinnerCube").empty();
          showAlert(txStatusUp, 'The transaction will fail, not sending.', 100);
          throw new Error("The transaction will fail, not sending");
        }
        const txObj = await rpsInstance.resume({
            from: App.account
          })
          .on('transactionHash', function (hash) {
            outSpinner();
            showSuccess(txStatusUp, 'Transact on the way ' + hash, 1000);
          })
          .on('receipt', function (receipt) {
            if (!receipt.status) {
              $("#txStatusUp").empty();
              throw new Error("The transaction failed");
            }
            console.log(receipt);
            $("#txStatusUp").empty();
            $(".spinnerCube").empty();
            showSuccess(txStatusUp, "You just reactivated the contract", 100);
            App.checkActivity();
          })
          .on('error', function (err) {
            $("#txStatusUp").empty();
            showAlert(txStatusUp, err, 100);
          });
      } else {
        const success = await rpsInstance.pause.call({
          from: App.account
        })
        if (!success) {
          $("#txStatusUp").empty();
          $(".spinnerCube").empty();
          showAlert(txStatusUp, 'The transaction will fail, not sending.', 100);
          throw new Error("The transaction will fail, not sending");
        }
        const txObj = await rpsInstance.pause({
            from: App.account
          })
          .on('transactionHash', function (hash) {
            outSpinner();
            showSuccess(txStatusUp, 'Transact on the way ' + hash, 1000);
          })
          .on('receipt', function (receipt) {
            if (!receipt.status) {
              $("#txStatusUp").empty();
              throw new Error("The transaction failed");
            }
            console.log(receipt);
            $("#txStatusUp").empty();
            $(".spinnerCube").empty();
            showSuccess(txStatusUp, "You just paused the contract", 100);
            App.checkActivity();
          })
          .on('error', function (err) {
            $("#txStatusUp").empty();
            showAlert(txStatusUp, err, 100);
          });
      }

    }).catch(function (err) {
      $(".spinnerCube").empty();
      console.log(err.message);
      showAlert(txStatusUp, 'Transaction rejected: ' + err.message);
    });
  },

  kill: async function () {
    $(".spinnerCube").empty();
    $("#txStatusUp").empty();
    cubeSpinner('#txStatusUp');
    const rpsInstance = await App.RockPaperScissors.deployed();
    const success = await rpsInstance.kill.call({
      from: App.account
    })
    if (!success) {
      $("#txStatusUp").empty();
      $(".spinnerCube").empty();
      showAlert(txStatusUp, 'The transaction will fail, not sending.', 100);
      throw new Error("The transaction will fail, not sending");
    }
    const txObj = await rpsInstance.kill({
        from: App.account
      })
      .on('transactionHash', function (hash) {
        outSpinner();
        showSuccess(txStatusUp, 'Transact on the way ' + hash, 1000);
      })
      .on('receipt', function (receipt) {
        if (!receipt.status) {
          $("#txStatusUp").empty();
          throw new Error("The transaction failed");
        }
        console.log(receipt);
        $("#txStatusUp").empty();
        $(".spinnerCube").empty();
        showSuccess(txStatusUp, "You just killed the contract", 100);
        App.checkActivity();
      })
      .on('error', function (err) {
        $("#txStatusUp").empty();
        showAlert(txStatusUp, err, 100);
      });
  },

  emergencyWithdraw: async function () {
    $(".spinnerCube").empty();
    $("#txStatusUp").empty();
    cubeSpinner('#txStatusUp');
    const rpsInstance = await App.RockPaperScissors.deployed();
    const success = await rpsInstance.emergencyWithdraw.call({
      from: App.account
    })
    if (!success) {
      $("#txStatusUp").empty();
      $(".spinnerCube").empty();
      showAlert(txStatusUp, 'The transaction will fail, not sending.', 100);
      throw new Error("The transaction will fail, not sending");
    }
    const txObj = await rpsInstance.emergencyWithdraw({
        from: App.account
      })
      .on('transactionHash', function (hash) {
        outSpinner();
        showSuccess(txStatusUp, 'Transact on the way ' + hash, 1000);
      })
      .on('receipt', function (receipt) {
        if (!receipt.status) {
          $("#txStatusUp").empty();
          throw new Error("The transaction failed");
        }
        console.log(receipt);
        $("#txStatusUp").empty();
        $(".spinnerCube").empty();
        showSuccess(txStatusUp, "You just withdrew all the funds from the contract", 100);
        App.updateBalanceContract();
        App.updateBalanceSender();
      })
      .on('error', function (err) {
        $("#txStatusUp").empty();
        showAlert(txStatusUp, err, 100);
      });
  },

  playerOneMove: async function () {
    $(".spinnerCube").empty();
    $("#txStatusUp").empty();
    cubeSpinner('#txStatusUp');
    const hashPlayerOneMove = $('#hashPlayerOneMove').val();
    const amount = $('#amount').val();
    const playerTwo = $('#playerTwo').val();
    const blockDays = $('#blockDays').val();
    const blockDaysLimit = blockDays * (86400 / 15);
    const rpsInstance = await App.RockPaperScissors.deployed();
    const success = await rpsInstance.playerOneMove.call(hashPlayerOneMove, playerTwo, blockDaysLimit, {
      value: amount,
      from: App.account
    })
    if (!success) {
      $("#txStatusUp").empty();
      $(".spinnerCube").empty();
      showAlert(txStatusUp, 'The transaction will fail, not sending.', 100);
      throw new Error("The transaction will fail, not sending");
    }
    const txObj = await rpsInstance.playerOneMove(hashPlayerOneMove, playerTwo, blockDaysLimit, {
        value: amount,
        from: App.account
      })
      .on('transactionHash', function (hash) {
        outSpinner();
        showSuccess(txStatusUp, 'Transact on the way ' + hash, 1000);
      })
      .on('receipt', function (receipt) {
        if (!receipt.status) {
          $("#txStatusUp").empty();
          throw new Error("The transaction failed");
        }
        console.log(receipt);
        $("#txStatusUp").empty();
        $(".spinnerCube").empty();
        showSuccess(txStatusUp, "You have bet " + App.weiToEth(amount) + " with the player address " + playerTwo + " if he doesn´t make a move you can reclaim your ETH in " + blockDays + " days.", 1000);
        App.updateBalanceContract();
        App.updateBalanceSender();
        // App.updateBalanceFees();
      })
      .on('error', function (err) {
        $("#txStatusUp").empty();
        showAlert(txStatusUp, err, 100);
      });
  },

  playerTwoMove: async function () {
    $("#txStatusUp").empty();
    if (!$("input[name='playerTwoMove']:checked").val()) {
      showAlert(txStatusUp, "Please select a move", 100);
      return false;
    }
    cubeSpinner('#txStatusUp');
    const playerTwoMove = $('input[name=playerTwoMove]:checked').val();
    const hashPlayerTwoMove = $('#hashPlayerTwoMove').val();
    const rpsInstance = await App.RockPaperScissors.deployed();
    const game = await rpsInstance.games(hashPlayerTwoMove);
    const amount = game.bet;
    const playerOne = game.playerOne;
    const success = await rpsInstance.playerTwoMove.call(hashPlayerTwoMove, playerTwoMove, {
      value: amount,
      from: App.account
    })
    if (!success) {
      $("#txStatusUp").empty();
      $(".spinnerCube").empty();
      showAlert(txStatusUp, 'The transaction will fail, not sending.', 100);
      throw new Error("The transaction will fail, not sending");
    }
    const txObj = await rpsInstance.playerTwoMove(hashPlayerTwoMove, playerTwoMove, {
        value: amount,
        from: App.account
      })
      .on('transactionHash', function (hash) {
        outSpinner();
        showSuccess(txStatusUp, 'Transact on the way ' + hash, 1000);
      })
      .on('receipt', function (receipt) {
        if (!receipt.status) {
          $("#txStatusUp").empty();
          throw new Error("The transaction failed");
        }
        console.log(receipt);
        $("#txStatusUp").empty();
        $(".spinnerCube").empty();
        showSuccess(txStatusUp, "You have bet " + App.weiToEth(amount) + " against Player One: "+playerOne+". If he doesn´t make a move in 1 day. You can claim the winning prize", 1000);
        App.updateBalanceContract();
        App.updateBalanceSender();
        // App.updateBalanceFees();
        $('input[name="playerTwoMove"]').prop('checked', false);
      })
      .on('error', function (err) {
        $("#txStatusUp").empty();
        showAlert(txStatusUp, err, 100);
      });
  },

  showMoveOne: async function () {
    $("#txStatusUp").empty();
    if (!$("input[name='moveShowMoveOne']:checked").val()) {
      showAlert(txStatusUp, "Please select a move", 100);
      return false;
    }
    cubeSpinner('#txStatusUp');
    const passwordShowMoveOne = App.bytes32($('#passwordShowMoveOne').val());
    const moveShowMoveOne = $('input[name=moveShowMoveOne]:checked').val();
    const rpsInstance = await App.RockPaperScissors.deployed();
    const success = await rpsInstance.showMoveOne.call(passwordShowMoveOne, moveShowMoveOne, {
      from: App.account
    })
    if (!success) {
      $("#txStatusUp").empty();
      $(".spinnerCube").empty();
      showAlert(txStatusUp, 'The transaction will fail, not sending.', 100);
      throw new Error("The transaction will fail, not sending");
    }
    const txObj = await rpsInstance.showMoveOne(passwordShowMoveOne, moveShowMoveOne, {
        from: App.account
      })
      .on('transactionHash', function (hash) {
        outSpinner();
        showSuccess(txStatusUp, 'Transact on the way ' + hash, 1000);
      })
      .on('receipt', function (receipt) {
        if (!receipt.status) {
          $("#txStatusUp").empty();
          throw new Error("The transaction failed");
        }
        console.log(receipt);
        $("#txStatusUp").empty();
        $(".spinnerCube").empty();
        showSuccess(txStatusUp, "Transaction Complete", 1000);
        App.updateBalanceContract();
        App.updateBalanceSender();
        // App.updateBalanceFees();
        $('input[name="showMoveOne"]').prop('checked', false);
      })
      .on('error', function (err) {
        $("#txStatusUp").empty();
        showAlert(txStatusUp, err, 100);
      });
  },

  claimNoGame: function () {
    const hashClaimNoGame = $("#hashClaimNoGame").val();
    let rpsInstance;
    return App.RockPaperScissors.deployed()
      .then(instance => {
        rpsInstance = instance;
        // Simulate the real call
        return rpsInstance.claimNoGame.call(hashClaimNoGame, {
          from: App.account
        });
      })
      .then(success => {
        if (!success) {
          $("#txStatusUp").empty();
          $(".spinnerCube").empty();
          showAlert(txStatusUp, 'The transaction will fail, not sending.', 100);
          throw new Error("The transaction will fail anyway, not sending");
        }
        return rpsInstance.claimNoGame(hashClaimNoGame, {
            from: App.account
          })
          .on('transactionHash', function (hash) {
            outSpinner();
            showSuccess(txStatusUp, 'Transact on the way ' + hash, 1000);
          })
          .on('receipt', function (receipt) {
            if (!receipt.status) {
              $("#txStatusUp").empty();
              throw new Error("The transaction failed");
            }
            console.log(receipt);
            $("#txStatusUp").empty();
            $(".spinnerCube").empty();
            showSuccess(txStatusUp, "Reclaim has been satisfactory.", 1000);
            App.updateBalanceContract();
            App.updateBalanceSender();
          })
          .on('error', function (err) {
            $("#txStatusUp").empty();
            showAlert(txStatusUp, err, 100);
          });
      });
  },

  claimMoveOneNotShown: function () {
    const hashClaimMoveOneNotShown = $("#hashClaimMoveOneNotShown").val();
    let rpsInstance;
    return App.RockPaperScissors.deployed()
      .then(instance => {
        rpsInstance = instance;
        // Simulate the real call
        return rpsInstance.claimMoveOneNotShown.call(hashClaimMoveOneNotShown, {
          from: App.account
        });
      })
      .then(success => {
        if (!success) {
          $("#txStatusUp").empty();
          $(".spinnerCube").empty();
          showAlert(txStatusUp, 'The transaction will fail, not sending.', 100);
          throw new Error("The transaction will fail anyway, not sending");
        }
        return rpsInstance.claimMoveOneNotShown(hashClaimMoveOneNotShown, {
            from: App.account
          })
          .on('transactionHash', function (hash) {
            outSpinner();
            showSuccess(txStatusUp, 'Transact on the way ' + hash, 1000);
          })
          .on('receipt', function (receipt) {
            if (!receipt.status) {
              $("#txStatusUp").empty();
              throw new Error("The transaction failed");
            }
            console.log(receipt);
            $("#txStatusUp").empty();
            $(".spinnerCube").empty();
            showSuccess(txStatusUp, "Reclaim has been satisfactory. Congratulations you are the winner.", 1000);
            App.updateBalanceContract();
            App.updateBalanceSender();
          })
          .on('error', function (err) {
            $("#txStatusUp").empty();
            showAlert(txStatusUp, err, 100);
          });
      });
  },

  withdraw: function () {
    let rpsInstance;
    return App.RockPaperScissors.deployed()
      .then(instance => {
        rpsInstance = instance;
        // Simulate the real call
        return rpsInstance.withdraw.call({
          from: App.account
        });
      })
      .then(success => {
        if (!success) {
          $("#txStatusUp").empty();
          $(".spinnerCube").empty();
          showAlert(txStatusUp, 'The transaction will fail, not sending.', 100);
          throw new Error("The transaction will fail anyway, not sending");
        }
        return rpsInstance.withdraw({
            from: App.account
          })
          .on('transactionHash', function (hash) {
            outSpinner();
            showSuccess(txStatusUp, 'Transact on the way ' + hash, 1000);
          })
          .on('receipt', function (receipt) {
            if (!receipt.status) {
              $("#txStatusUp").empty();
              throw new Error("The transaction failed");
            }
            console.log(receipt);
            $("#txStatusUp").empty();
            $(".spinnerCube").empty();
            showSuccess(txStatusUp, "Withdrawal has been satisfactory.", 1000);
            App.updateBalanceContract();
            App.updateBalanceSender();
          })
          .on('error', function (err) {
            $("#txStatusUp").empty();
            showAlert(txStatusUp, err, 100);
          });
      })
      .then(txObj => {
        const log = txObj.logs[0].args;
        showSuccess(txStatusUp, "Amount: " + App.weiToEth(log.amount), 1000);
      })
      .catch(e => {
        $("#txStatusUp").empty();
        showAlert(txStatusUp, e, 100);
        console.error(e);
      });
  },


  updateBalanceContract: function () {
    var rpsInstance;
    App.RockPaperScissors.deployed().then(function (instance) {
      rpsInstance = instance;
      var contractAddress = rpsInstance.address;
      web3.eth.getBalance(contractAddress, function (err, result) {
        document.getElementById("amountContract").innerHTML = "Contract Balance " + web3.utils.fromWei(result, "ether") + " ETH";
      })
    }).catch(function (err) {
      console.log(err.message);
    });
  },

  updateBalanceSender: async function () {
    var result = await App.getBalance(App.account);
    document.getElementById("yourBalance").innerHTML = result + " WEI";
    document.getElementById("yourBalanceEth").innerHTML = App.weiToEth(result);
    var result2 = await App.getCBalance(App.account);
    document.getElementById("yourCBalance").innerHTML = result2 + " WEI";
    document.getElementById("yourCBalanceEth").innerHTML = App.weiToEth(result2);
  },

  // updateBalanceFees: function () {
  //   var rpsInstance;
  //   App.RockPaperScissors.deployed().then(async function (instance) {
  //     rpsInstance = instance;
  //     const amount = await rpsInstance.feeBalance(App.account);
  //     document.getElementById("fees").innerHTML = amount;
  //     document.getElementById("feesEth").innerHTML = App.weiToEth(amount);
  //   }).catch(function (err) {
  //     console.log(err.message);
  //   });
  // },

  getBalance: async function (address) {
    const balance = promisify(cb => web3.eth.getBalance(address, cb))
    try {
      return balance
    } catch (error) {
      showAlert(txStatusUp, 'Transaction rejected: ' + error);
    }
  },

  getCBalance: async function () {
    const rpsInstance = await App.RockPaperScissors.deployed();
    const balance = await rpsInstance.balances(App.account);
    return balance;
  },

  weiToEth: function (amount) {
    return web3.utils.fromWei(amount, "ether") + " ETH";
  },

  bytes32: function (value) {
    return web3.utils.fromAscii(value);
  },

  hashIt: async function () {
    $("#txStatusUp").empty();
    if (!$("input[name='playerOneMove']:checked").val()) {
      showAlert(txStatusUp, "Please select a move", 100);
      return false;
    }
    cubeSpinner('#txStatusUp');
    const password = App.bytes32($('#password').val());
    const playerOneMove = $('input[name=playerOneMove]:checked').val();
    let rpsInstance = await App.RockPaperScissors.deployed();
    const hash = await rpsInstance.hashIt(password, playerOneMove, {
      from: App.account
    });
    $("#txStatusUp").empty();
    showSuccess(txStatusUp, 'Created Hash: ' + hash, 1000);
    $('input[name="playerOneMove"]').prop('checked', false);
  },

  updateLogPlayerOneMove: async function () {
    $("#txStatusUp").empty();
    $("#logPlayerOneMove").empty();
    var cont = 1;
    $("#logPlayerOneMove").append(`
      <table style=" width:100%; font-size: 11px;" id="tableLogPlayerOneMove" class="scene_element scene_element--fadeindown table bordered table-light table-hover table-striped table-bordered rounded">
        <tr>
          <th class="text-center">#</th>
          <th class="text-center">Tx Hash</th>
          <th class="text-center">Player One</th>
          <th class="text-center">Player Two</th>
          <th class="text-center">Bet</th>
          <th class="text-center">BlockLimit</th>
        </tr>
        <div id="tbody"></div>
      </table>
    `);
    var rpsInstance = await App.RockPaperScissors.deployed();
    rpsInstance.LogPlayerOneMove({
      fromBlock: 0
    }, function (error, event) {
      var datosEvento = event.args;
      var hash = datosEvento.hash;
      var amount = datosEvento.bet;
      var amountEth = web3.utils.fromWei(amount, "ether") + " ETH";
      var playerOne = datosEvento.playerOne;
      var playerTwo = datosEvento.playerTwo;
      var blockLimit = datosEvento.blockLimit;
      $("#tableLogPlayerOneMove tbody").after(`           
        <tr class="table table-light table-hover table-striped table-bordered rounded">
          <td class="p-1 text-center tdLogs">${cont}</td>
          <td class="p-1 text-center tdLogs">${hash}</td>
          <td class="p-1 text-center tdLogs">${playerOne}</td>
          <td class="p-1 text-center tdLogs">${playerTwo}</td>
          <td class="p-1 text-center tdLogs" title="${amount} WEI">${amountEth}</td>
          <td class="p-1 text-center tdLogs">${blockLimit}</td>
        </tr>               
      `);
      cont++;
    })
  },

  updateLogPlayerTwoMove: async function () {
    $("#txStatusUp").empty();
    $("#logPlayerTwoMove").empty();
    var cont = 1;
    $("#logPlayerTwoMove").append(`
      <table style=" width:100%; font-size: 11px;" id="tableLogPlayerTwoMove" class="scene_element scene_element--fadeindown table bordered table-light table-hover table-striped table-bordered rounded">
        <tr>
          <th class="text-center">#</th>
          <th class="text-center">Tx Hash</th>
          <th class="text-center">Move</th>
          <th class="text-center">Bet</th>
          <th class="text-center">BlockLimit</th>
        </tr>
        <div id="tbody"></div>
      </table>
    `);
    var rpsInstance = await App.RockPaperScissors.deployed();
    rpsInstance.LogPlayerTwoMove({
      fromBlock: 0
    }, function (error, event) {
      var datosEvento = event.args;
      var hash = datosEvento.hash;
      var amount = datosEvento.amount;
      var amountEth = web3.utils.fromWei(amount, "ether") + " ETH";
      var move = App.hand(datosEvento.move);
      var blockLimit = datosEvento.blockLimit;
      $("#tableLogPlayerTwoMove tbody").after(`           
        <tr class="table table-light table-hover table-striped table-bordered rounded">
          <td class="p-1 text-center tdLogs">${cont}</td>
          <td class="p-1 text-center tdLogs">${hash}</td>
          <td class="p-1 text-center tdLogs"><div class="${move}Small" title="${move}"><div></td>
          <td class="p-1 text-center tdLogs" title="${amount} WEI">${amountEth}</td>
          <td class="p-1 text-center tdLogs">${blockLimit}</td>
        </tr>               
      `);
      cont++;
    })
  },

  updateLogShowMoveOne: async function () {
    $("#txStatusUp").empty();
    $("#logShowMoveOne").empty();
    var cont = 1;
    $("#logShowMoveOne").append(`
      <table style=" width:100%; font-size: 11px;" id="tableLogShowMoveOne" class="scene_element scene_element--fadeindown table bordered table-light table-hover table-striped table-bordered rounded">
        <tr>
          <th class="text-center">#</th>
          <th class="text-center">Tx Hash</th>
          <th class="text-center">Move</th>
        </tr>
        <div id="tbody"></div>
      </table>
    `);
    var rpsInstance = await App.RockPaperScissors.deployed();
    rpsInstance.LogShowMoveOne({
      fromBlock: 0
    }, function (error, event) {
      var datosEvento = event.args;
      var hash = datosEvento.hash;
      var move = App.hand(datosEvento.move);
      $("#tableLogShowMoveOne tbody").after(`           
        <tr class="table table-light table-hover table-striped table-bordered rounded">
          <td class="p-1 text-center tdLogs">${cont}</td>
          <td class="p-1 text-center tdLogs">${hash}</td>
          <td class="p-1 text-center tdLogs">
          <div class="${move}Small" title="${move}"><div>
          </td>
        </tr>               
      `);
      cont++;
    })
  },

  updateLogWinner: async function () {
    $("#txStatusUp").empty();
    $("#logWinner").empty();
    var cont = 1;
    $("#logWinner").append(`
      <table style=" width:100%; font-size: 11px;" id="tableLogWinner" class="scene_element scene_element--fadeindown table bordered table-light table-hover table-striped table-bordered rounded">
        <tr>
          <th class="text-center">#</th>
          <th class="text-center">Tx Hash</th>
          <th class="text-center">Winner</th>
          <th class="text-center">Loser</th>
          <th class="text-center">Bet</th>
        </tr>
        <div id="tbody"></div>
      </table>
    `);
    var rpsInstance = await App.RockPaperScissors.deployed();
    rpsInstance.LogWinner({
      fromBlock: 0
    }, function (error, event) {
      var datosEvento = event.args;
      var hash = datosEvento.hash;
      var amount = datosEvento.bet;
      var amountEth = web3.utils.fromWei(amount, "ether") + " ETH";
      var winner = datosEvento.winner;
      var loser = datosEvento.loser;
      $("#tableLogWinner tbody").after(`           
        <tr class="table table-light table-hover table-striped table-bordered rounded">
          <td class="p-1 text-center tdLogs">${cont}</td>
          <td class="p-1 text-center tdLogs">${hash}</td>
          <td class="p-1 text-center tdLogs">${winner}</td>
          <td class="p-1 text-center tdLogs">${loser}</td>
          <td class="p-1 text-center tdLogs" title="${amount} WEI">${amountEth}</td>
        </tr>               
      `);
      cont++;
    })
  },

  updateLogDraw: async function () {
    $("#txStatusUp").empty();
    $("#logDraw").empty();
    var cont = 1;
    $("#logDraw").append(`
      <table style=" width:100%; font-size: 11px;" id="tableLogDraw" class="scene_element scene_element--fadeindown table bordered table-light table-hover table-striped table-bordered rounded">
        <tr>
          <th class="text-center">#</th>
          <th class="text-center">Tx Hash</th>
          <th class="text-center">Player One</th>
          <th class="text-center">Player Two</th>
          <th class="text-center">Bet</th>
        </tr>
        <div id="tbody"></div>
      </table>
    `);
    var rpsInstance = await App.RockPaperScissors.deployed();
    rpsInstance.LogDraw({
      fromBlock: 0
    }, function (error, event) {
      var datosEvento = event.args;
      var hash = datosEvento.hash;
      var amount = datosEvento.bet;
      var amountEth = web3.utils.fromWei(amount, "ether") + " ETH";
      var playerOne = datosEvento.playerOne;
      var playerTwo = datosEvento.playerTwo;
      $("#tableLogDraw tbody").after(`           
        <tr class="table table-light table-hover table-striped table-bordered rounded">
          <td class="p-1 text-center tdLogs">${cont}</td>
          <td class="p-1 text-center tdLogs">${hash}</td>
          <td class="p-1 text-center tdLogs">${playerOne}</td>
          <td class="p-1 text-center tdLogs">${playerTwo}</td>
          <td class="p-1 text-center tdLogs" title="${amount} WEI">${amountEth}</td>
        </tr>               
      `);
      cont++;
    })
  },

  updateLogClaimNoGame: async function () {
    $("#txStatusUp").empty();
    $("#logClaimNoGame").empty();
    var cont = 1;
    $("#logClaimNoGame").append(`
      <table style=" width:100%; font-size: 11px;" id="tableLogClaimNoGame" class="scene_element scene_element--fadeindown table bordered table-light table-hover table-striped table-bordered rounded">
        <tr>
          <th class="text-center">#</th>
          <th class="text-center">Tx Hash</th>
        </tr>
        <div id="tbody"></div>
      </table>
    `);
    var rpsInstance = await App.RockPaperScissors.deployed();
    rpsInstance.LogClaimNoGame({
      fromBlock: 0
    }, function (error, event) {
      var datosEvento = event.args;
      var hash = datosEvento.hash;
      var amount = datosEvento.bet;
      var amountEth = web3.utils.fromWei(amount, "ether") + " ETH";
      var playerOne = datosEvento.playerOne;
      var playerTwo = datosEvento.playerTwo;
      var blockLimit = datosEvento.blockLimit;
      $("#tableLogClaimNoGame tbody").after(`           
        <tr class="table table-light table-hover table-striped table-bordered rounded">
          <td class="p-1 text-center tdLogs">${cont}</td>
          <td class="p-1 text-center tdLogs">${hash}</td>
        </tr>               
      `);
      cont++;
    })
  },

  updateLogClaimMoveOneNotShown: async function () {
    $("#txStatusUp").empty();
    $("#logClaimMoveOneNotShown").empty();
    var cont = 1;
    $("#logClaimMoveOneNotShown").append(`
      <table style=" width:100%; font-size: 11px;" id="tableLogClaimMoveOneNotShown" class="scene_element scene_element--fadeindown table bordered table-light table-hover table-striped table-bordered rounded">
        <tr>
          <th class="text-center">#</th>
          <th class="text-center">Tx Hash</th>
          <th class="text-center">Player One</th>
          <th class="text-center">Player Two</th>
          <th class="text-center">Bet</th>
          <th class="text-center">BlockLimit</th>
        </tr>
        <div id="tbody"></div>
      </table>
    `);
    var rpsInstance = await App.RockPaperScissors.deployed();
    rpsInstance.LogClaimMoveOneNotShown({
      fromBlock: 0
    }, function (error, event) {
      var datosEvento = event.args;
      var hash = datosEvento.hash;
      $("#tableLogClaimMoveOneNotShown tbody").after(`           
        <tr class="table table-light table-hover table-striped table-bordered rounded">
          <td class="p-1 text-center tdLogs">${cont}</td>
          <td class="p-1 text-center tdLogs">${hash}</td>
        </tr>               
      `);
      cont++;
    })
  },

  updateLogWithdrawn: async function () {
    $("#txStatusUp").empty();
    $("#logWithdrawn").empty();
    var cont = 1;
    $("#logWithdrawn").append(`
      <table style=" width:100%; font-size: 11px;" id="tableLogWithdrawn" class="scene_element scene_element--fadeindown table bordered table-light table-hover table-striped table-bordered rounded">
        <tr>
          <th class="text-center">#</th>
          <th class="text-center">Amount</th>
          <th class="text-center">Account</th>
        </tr>
        <div id="tbody"></div>
      </table>
    `);
    var rpsInstance = await App.RockPaperScissors.deployed();
    rpsInstance.LogWithdrawn({
      fromBlock: 0
    }, function (error, event) {
      var datosEvento = event.args;
      var amount = datosEvento.amount;
      var amountEth = web3.utils.fromWei(amount, "ether") + " ETH";
      var account = datosEvento.account;
      $("#tableLogWithdrawn tbody").after(`           
        <tr class="table table-light table-hover table-striped table-bordered rounded">
          <td class="p-1 text-center tdLogs">${cont}</td>
          <td class="p-1 text-center tdLogs" title="${amount} WEI">${amountEth}</td>
          <td class="p-1 text-center tdLogs">${account}</td>
        </tr>               
      `);
      cont++;
    })
  },

  hand: function(move) {
    if(move==1) return "rock";
    else if(move==2) return "paper";
    else return "scissors";
  }

};

$("#amount").keyup(function () {
  document.getElementById('amountEth').innerHTML = App.weiToEth($('#amount').val());
  validateBigAmount('amount');
});

$(function () {
  $(window).on('load', function () {
    App.initWeb3();
  });
});