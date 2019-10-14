const RockPaperScissors = artifacts.require("RockPaperScissors.sol");
const {
  toBN,
  toWei,
  fromAscii
} = web3.utils;

advanceBlock = () => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_mine',
      id: new Date().getTime()
    }, (err, result) => {
      if (err) {
        return reject(err)
      }
      return resolve(result)
    })
  })
}

contract('RockPaperScissors', (accounts) => {
  let rpsInstance, hash;
  const [playerOne, playerTwo] = accounts;
  const password = fromAscii(Math.random());
  const moveOne = 1;  //Rock
  const moveTwo = 3;  //Scissors
  const shortAmount = toBN(toWei('0.00000000000000001'));
  const amount = toBN(toWei('0.01'));
  const bigAmount = toBN(toWei('90'));
  const userBlockLimit = 10;
  const maxBlockLimit = 86400 / 15;
  const theZeroAccount = '0x0000000000000000000000000000000000000000';

  beforeEach('deploy a new RockPaperScissors and create a hash', async function () {
    rpsInstance = await RockPaperScissors.new(false, {
      from: playerOne
    });

    hash = await rpsInstance.hashIt(password, moveOne);
  });

  it('should do the first move from playerOne', async function () {
    // Calculate balances expected.
    const balanceContractBefore = toBN(await web3.eth.getBalance(rpsInstance.address));
    const balanceContractExpected = balanceContractBefore.add(amount);

    // Transaction.
    await rpsInstance.playerOneMove(hash, playerTwo, userBlockLimit, {
      value: amount,
      from: playerOne
    });

    // Get balance of contract account after transaction.
    const balanceContractAfterTx = await web3.eth.getBalance(rpsInstance.address);

    // Check
    assert.strictEqual(balanceContractAfterTx, balanceContractExpected.toString(10), "Balance error in contract account")
  });

  it('should store Game variables in the contract', async function () {
    // Check values before Tx
    const check1 = await rpsInstance.games(hash);
    assert.strictEqual(check1.playerOne, theZeroAccount, "Error in playerOne account Before Tx")
    assert.strictEqual(check1.playerTwo, theZeroAccount, "Error in playerTwo account Before Tx")
    assert.strictEqual(check1.bet.toString(10), '0', "Error in bet amount Before Tx")
    assert.strictEqual(check1.blockLimit.toString(10), '0', "Error in blockLimit Before Tx")
    assert.strictEqual(check1.moveTwo.toString(10), '0', "Error in moveTwo Before Tx")

    // Transaction
    const tx = await rpsInstance.playerOneMove(hash, playerTwo, userBlockLimit, {
      from: playerOne,
      value: amount
    });

    const betAmountExpected = amount;
    const blockLimitExpected = tx.receipt.blockNumber + userBlockLimit;

    // Check values after Tx
    const check2 = await rpsInstance.games(hash);
    assert.strictEqual(check2.playerOne, playerOne, "Error in PlayerOne account After Tx")
    assert.strictEqual(check2.playerTwo, playerTwo, "Error in PlayerTwo account After Tx")
    assert.strictEqual(check2.bet.toString(10), betAmountExpected.toString(10), "Error in bet amount After Tx")
    assert.strictEqual(check2.blockLimit.toString(10), blockLimitExpected.toString(10), "Error in blockLimit After Tx")
  });

  it('should check the emitted LogPlayerOneMove event', async function () {
    // Transaction
    const tx = await rpsInstance.playerOneMove(hash, playerTwo, userBlockLimit, {
      from: playerOne,
      value: amount
    });

    const log = tx.logs[0].args;
    const blockLimitExpected = tx.receipt.blockNumber + userBlockLimit;

    // Checks
    assert.strictEqual(tx.logs.length, 1);
    assert.strictEqual(log.hash, hash);
    assert.strictEqual(log.playerOne, playerOne);
    assert.strictEqual(log.playerTwo, playerTwo);
    assert.strictEqual(log.bet.toString(10), amount.toString(10));
    assert.strictEqual(log.blockLimit.toString(10), blockLimitExpected.toString(10));
    assert.strictEqual(tx.logs[0].event, 'LogPlayerOneMove');
  });

  it('should do the second move from playerTwo and check the LogPlayerTwoMove event', async function () {
    // Transactions
    await rpsInstance.playerOneMove(hash, playerTwo, userBlockLimit, {
      from: playerOne,
      value: amount
    });
    const tx2 = await rpsInstance.playerTwoMove(hash, moveTwo, {
      from: playerTwo,
      value: amount
    });

    const blockLimitExpected = tx2.receipt.blockNumber + maxBlockLimit;

    // Check values after Tx2
    const check2 = await rpsInstance.games(hash);
    assert.strictEqual(check2.moveTwo.toString(10), moveTwo.toString(10), "Error in moveTwo After Tx2")
    assert.strictEqual(check2.blockLimit.toString(10), blockLimitExpected.toString(10), "Error in blockLimit After Tx2")

    const log = tx2.logs[0].args;

    // Checks
    assert.strictEqual(tx2.logs.length, 1);
    assert.strictEqual(log.hash, hash);
    assert.strictEqual(log.move.toString(10), moveTwo.toString(10));
    assert.strictEqual(log.amount.toString(10), amount.toString(10));
    assert.strictEqual(log.blockLimit.toString(10), blockLimitExpected.toString(10));
    assert.strictEqual(tx2.logs[0].event, 'LogPlayerTwoMove');
  });

  it('should reveal the playerOne move, declare the winner (playerOne), check clear storage of the game and the LogShowMoveOne event', async function () {
    // Transactions
    await rpsInstance.playerOneMove(hash, playerTwo, userBlockLimit, {
      from: playerOne,
      value: amount
    });
    await rpsInstance.playerTwoMove(hash, moveTwo, {
      from: playerTwo,
      value: amount
    });
    const tx3 = await rpsInstance.showMoveOne(password, moveOne, {
      from: playerOne
    });

    const log = tx3.logs[0].args;

    // Check storage values after tx3.
    const check = await rpsInstance.games(hash);
    assert.strictEqual(check.playerOne, playerOne, "Error in playerOne account After Tx")
    assert.strictEqual(check.playerTwo, theZeroAccount, "Error in playerTwo account After Tx")
    assert.strictEqual(check.bet.toString(10), '0', "Error in bet amount After Tx")
    assert.strictEqual(check.blockLimit.toString(10), '0', "Error in blockLimit After Tx")
    assert.strictEqual(check.moveTwo.toString(10), '0', "Error in moveTwo After Tx")

    // Check emitted event.
    assert.strictEqual(tx3.logs.length, 2);
    assert.strictEqual(log.hash, hash);
    assert.strictEqual(log.move.toString(10), moveOne.toString(10));
    assert.strictEqual(tx3.logs[0].event, 'LogShowMoveOne');
  });

  it('should reveal the playerOne move, declare the winner (playerOne), check his balance and the LogWinner event', async function () {
    // Transactions
    await rpsInstance.playerOneMove(hash, playerTwo, userBlockLimit, {
      from: playerOne,
      value: amount
    });
    await rpsInstance.playerTwoMove(hash, moveTwo, {
      from: playerTwo,
      value: amount
    });

    // Get playerOne balance before Tx3
    const balancePlayerOneBeforeTx3 = await rpsInstance.balances(playerOne);
    const balancePlayerOneExpected = toBN(balancePlayerOneBeforeTx3.add(amount.mul(toBN(2))));

    const tx3 = await rpsInstance.showMoveOne(password, moveOne, {
      from: playerOne
    });

    // Get playerOne balance after Tx3
    const balancePlayerOneAfterTx3 = await rpsInstance.balances(playerOne);

    // Check
    assert.strictEqual(balancePlayerOneAfterTx3.toString(10), balancePlayerOneExpected.toString(10), "Balance error in PlayerOne account")

    
    const log = tx3.logs[1].args;

    // Checks
    assert.strictEqual(tx3.logs.length, 2);
    assert.strictEqual(log.hash, hash);
    assert.strictEqual(log.winner, playerOne);
    assert.strictEqual(log.loser, playerTwo);
    assert.strictEqual(log.bet.toString(10), amount.toString(10));
    assert.strictEqual(tx3.logs[1].event, 'LogWinner');
  });

  it('Same function than before with shortAmount', async function () {
    // Transactions
    await rpsInstance.playerOneMove(hash, playerTwo, userBlockLimit, {
      from: playerOne,
      value: shortAmount
    });
    await rpsInstance.playerTwoMove(hash, moveTwo, {
      from: playerTwo,
      value: shortAmount
    });

    // Get playerOne balance before Tx3
    const balancePlayerOneBeforeTx3 = await rpsInstance.balances(playerOne);
    const balancePlayerOneExpected = toBN(balancePlayerOneBeforeTx3.add(shortAmount.mul(toBN(2))));

    const tx3 = await rpsInstance.showMoveOne(password, moveOne, {
      from: playerOne
    });

    // Get playerOne balance after Tx3
    const balancePlayerOneAfterTx3 = await rpsInstance.balances(playerOne);

    // Check
    assert.strictEqual(balancePlayerOneAfterTx3.toString(10), balancePlayerOneExpected.toString(10), "Balance error in PlayerOne account")

    
    const log = tx3.logs[1].args;

    // Checks
    assert.strictEqual(tx3.logs.length, 2);
    assert.strictEqual(log.hash, hash);
    assert.strictEqual(log.winner, playerOne);
    assert.strictEqual(log.loser, playerTwo);
    assert.strictEqual(log.bet.toString(10), shortAmount.toString(10));
    assert.strictEqual(tx3.logs[1].event, 'LogWinner');
  });

  it('Same function than before with bigAmount', async function () {
    // Transactions
    await rpsInstance.playerOneMove(hash, playerTwo, userBlockLimit, {
      from: playerOne,
      value: bigAmount
    });
    await rpsInstance.playerTwoMove(hash, moveTwo, {
      from: playerTwo,
      value: bigAmount
    });

    // Get playerOne balance before Tx3
    const balancePlayerOneBeforeTx3 = await rpsInstance.balances(playerOne);
    const balancePlayerOneExpected = toBN(balancePlayerOneBeforeTx3.add(bigAmount.mul(toBN(2))));

    const tx3 = await rpsInstance.showMoveOne(password, moveOne, {
      from: playerOne
    });

    // Get playerOne balance after Tx3
    const balancePlayerOneAfterTx3 = await rpsInstance.balances(playerOne);

    // Check
    assert.strictEqual(balancePlayerOneAfterTx3.toString(10), balancePlayerOneExpected.toString(10), "Balance error in PlayerOne account")

    
    const log = tx3.logs[1].args;

    // Checks
    assert.strictEqual(tx3.logs.length, 2);
    assert.strictEqual(log.hash, hash);
    assert.strictEqual(log.winner, playerOne);
    assert.strictEqual(log.loser, playerTwo);
    assert.strictEqual(log.bet.toString(10), bigAmount.toString(10));
    assert.strictEqual(tx3.logs[1].event, 'LogWinner');
  });

  it('should reveal playerOne move, declare a Draw, check their balances, and the LogDraw event', async function () {
    // Transactions
    await rpsInstance.playerOneMove(hash, playerTwo, userBlockLimit, {
      from: playerOne,
      value: amount
    });
    await rpsInstance.playerTwoMove(hash, moveOne, {
      from: playerTwo,
      value: amount
    });

    // Get balances before Tx3
    const balancePlayerOneBeforeTx3 = await rpsInstance.balances(playerOne);
    const balancePlayerOneExpected = toBN(balancePlayerOneBeforeTx3.add(amount));
    const balancePlayerTwoBeforeTx3 = await rpsInstance.balances(playerTwo);
    const balancePlayerTwoExpected = toBN(balancePlayerTwoBeforeTx3.add(amount));

    const tx3 = await rpsInstance.showMoveOne(password, moveOne, {
      from: playerOne
    });

    // Get playerOne balance after Tx3
    const balancePlayerOneAfterTx3 = await rpsInstance.balances(playerOne);
    const balancePlayerTwoAfterTx3 = await rpsInstance.balances(playerTwo);

    // Check
    assert.strictEqual(balancePlayerOneAfterTx3.toString(10), balancePlayerOneExpected.toString(10), "Balance error in PlayerOne account")
    assert.strictEqual(balancePlayerTwoAfterTx3.toString(10), balancePlayerTwoExpected.toString(10), "Balance error in PlayerTwo account")

    
    const log = tx3.logs[1].args;

    // Checks
    assert.strictEqual(tx3.logs.length, 2);
    assert.strictEqual(log.hash, hash);
    assert.strictEqual(log.playerOne, playerOne);
    assert.strictEqual(log.playerTwo, playerTwo);
    assert.strictEqual(log.bet.toString(10), amount.toString(10));
    assert.strictEqual(tx3.logs[1].event, 'LogDraw');
  });

  it('should withdraw the winning bet and check the LogWithdrawn event', async function () {

    // Transactions
    await rpsInstance.playerOneMove(hash, playerTwo, userBlockLimit, {
      from: playerOne,
      value: amount
    });
    await rpsInstance.playerTwoMove(hash, moveTwo, {
      from: playerTwo,
      value: amount
    });
    await rpsInstance.showMoveOne(password, moveOne, {
      from: playerOne
    });

    // Calculate balance.
    const balancePlayerOneBefore = toBN(await web3.eth.getBalance(playerOne));

    const tx4 = await rpsInstance.withdraw({
      from: playerOne
    });

    // PlayerOne Balance (with bet winning expected)(without gas costs)
    const balancePlayerOneWithoutGasCost = toBN(balancePlayerOneBefore.add(amount.mul(toBN(2))));

    // Get gas cost from tx4
    const transaction = await web3.eth.getTransaction(tx4.tx);
    const gasPrice = transaction.gasPrice;
    const gasUsed = toBN(tx4.receipt.gasUsed);
    const gasCost = gasUsed.mul(toBN(gasPrice));

    // Calculate PlayerOne balance expected (with gas costs).
    const balancePlayerOneExpected = balancePlayerOneWithoutGasCost.sub(gasCost);
    // Calculate withdraw amount expected
    const withdrawAmountExpected = amount.add(amount);

    // Get balance of PlayerTwo account after transactions.
    const balancePlayerOneAfterTx = await web3.eth.getBalance(playerOne);

    const log = tx4.logs[0].args;

    // Checks
    assert.strictEqual(balancePlayerOneAfterTx, balancePlayerOneExpected.toString(10), "Balance error in PlayerOne account")
    // LogWithdrawn
    assert.strictEqual(tx4.logs.length, 1);
    assert.strictEqual(log.amount.toString(10), withdrawAmountExpected.toString(10));
    assert.strictEqual(log.account, playerOne);
    assert.strictEqual(tx4.logs[0].event, 'LogWithdrawn');
  });

  it('should claim No Game, check playerOne balance and the LogClaimNoGame event', async function () {
    // Get playerOne balance before Tx
    const balancePlayerOneBeforeTx = await rpsInstance.balances(playerOne);
    const balancePlayerOneExpected = toBN(balancePlayerOneBeforeTx.add(amount));

    // Transaction 1 (First Move)
    await rpsInstance.playerOneMove(hash, playerTwo, userBlockLimit, {
      from: playerOne,
      value: amount
    });

    // Transaction 2. (For the blockLimit to expire)
    for(i = 0; i < userBlockLimit; i++){
      await advanceBlock();
    }

    // Transaction 3
    const tx3 = await rpsInstance.claimNoGame(hash, {
      from: playerOne
    });
    const log = tx3.logs[0].args;
    // Get playerOne balance After Tx
    const balancePlayerOneAfterTx = await rpsInstance.balances(playerOne);

    // Checks
    assert.strictEqual(balancePlayerOneAfterTx.toString(10), balancePlayerOneExpected.toString(10), "Balance error in PlayerOne account")
    assert.strictEqual(tx3.logs.length, 1);
    assert.strictEqual(log.hash, hash);
    assert.strictEqual(tx3.logs[0].event, 'LogClaimNoGame');
  });

  it('should claim Move One Not Shown, check playerTwo balance, the LogClaimMoveOneNotShown and the LogWinner events', async function () {
    // Get playerOne balance before Tx
    const balancePlayerTwoBeforeTx = await rpsInstance.balances(playerTwo);
    const balancePlayerTwoExpected = toBN(balancePlayerTwoBeforeTx.add(amount.mul(toBN(2))));

    // Transaction 1 (First Move)
    await rpsInstance.playerOneMove(hash, playerTwo, userBlockLimit, {
      from: playerOne,
      value: amount
    });

    // Transaction 2 (Second Move)
    await rpsInstance.playerTwoMove(hash, moveTwo, {
      from: playerTwo,
      value: amount
    });

    // Transaction 3. (For the blockLimit to expire)
    for(i = 0; i < maxBlockLimit; i++){
      await advanceBlock();
    }

    // Transaction 4
    const tx4 = await rpsInstance.claimMoveOneNotShown(hash, {
      from: playerOne
    });
    const log1 = tx4.logs[0].args;
    const log2 = tx4.logs[1].args;

    // Get playerOne balance After Tx
    const balancePlayerTwoAfterTx = await rpsInstance.balances(playerTwo);

    // Checks
    assert.strictEqual(balancePlayerTwoAfterTx.toString(10), balancePlayerTwoExpected.toString(10), "Balance error in PlayerTwo account");
    // Logs
    assert.strictEqual(tx4.logs.length, 2);
    // LogClaimMoveOneNotShown
    assert.strictEqual(log1.hash, hash);
    assert.strictEqual(tx4.logs[0].event, 'LogClaimMoveOneNotShown');
    // LogWinner
    assert.strictEqual(log2.hash, hash);
    assert.strictEqual(log2.winner, playerTwo);
    assert.strictEqual(log2.loser, playerOne);
    assert.strictEqual(log2.bet.toString(10), amount.toString(10));
    assert.strictEqual(tx4.logs[1].event, 'LogWinner');
    
  });

  it('should kill the contract and withdraw the funds', async function () {
    // Transaction 1 (First Move)
    await rpsInstance.playerOneMove(hash, playerTwo, userBlockLimit, {
      from: playerOne,
      value: amount
    });

    // Transaction 2 (Second Move)
    await rpsInstance.playerTwoMove(hash, moveTwo, {
      from: playerTwo,
      value: amount
    });

    // Transaction 3.
    await rpsInstance.pause({
      from: playerOne
    });

    // Transaction 4.
    await rpsInstance.kill({
      from: playerOne
    });

    // Calculate PlayerOne balance.
    const balancePlayerOneBefore = toBN(await web3.eth.getBalance(playerOne));

    // Transaction 5.
    const tx5 = await rpsInstance.emergencyWithdraw({
      from: playerOne
    });

    // Get gas cost from tx5
    const transaction = await web3.eth.getTransaction(tx5.tx);
    const gasPrice = transaction.gasPrice;
    const gasUsed = toBN(tx5.receipt.gasUsed);
    const gasCost = gasUsed.mul(toBN(gasPrice));

    // Calculate PlayerOne balance expected (with playerTwo bet amount)(with tx gas cost).
    const balancePlayerOneExpected = balancePlayerOneBefore.add(amount).sub(gasCost);

    // Get balance of PlayerOne account after transactions.
    const balancePlayerOneAfterTx = await web3.eth.getBalance(playerOne);

    // Check
    assert.strictEqual(balancePlayerOneAfterTx, balancePlayerOneExpected.toString(10), "Balance error in PlayerOne account")
  });

});