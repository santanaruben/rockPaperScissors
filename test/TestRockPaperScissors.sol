pragma solidity >=0.5.0 <0.6.0;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/RockPaperScissors.sol";

contract TestRockPaperScissors {

    uint public initialBalance = 0.01 ether;
    uint public constant amountToSend = 0.01 ether;
    uint public constant maxBlocksLimit = 10;
    address playerTwo = 0xFAf56184419A832E3274C739D7fc8e39942B52e2;
    RockPaperScissors r = new RockPaperScissors(false);
    bytes32 hash = r.hashIt(bytes32(0), RockPaperScissors.Move.rock);     // Hash key

    function testPlayerOneMove()
        public
    {
        // Initial values
        uint balanceContractInitial = address(r).balance;
        (,,uint playerOneBetInitial,,,) = r.games(hash);
        // Expected values
        uint balanceContractExpected = balanceContractInitial + amountToSend;
        uint playerOneBetExpected = playerOneBetInitial + amountToSend;
        uint blockLimitExpected = block.number + maxBlocksLimit;
        // Transaction
        r.playerOneMove.value(amountToSend)(hash, playerTwo);
        // Values after transaction
        uint balanceContractAfterTx = address(r).balance;
        (,,uint playerOneBetAfterTx, uint blockLimitAfterTx,,) = r.games(hash);
        // Asserts
        Assert.equal(balanceContractAfterTx, balanceContractExpected, "Error in Contract Balance");
        Assert.equal(playerOneBetAfterTx, playerOneBetExpected, "Error in Player One Bet");
        Assert.equal(blockLimitAfterTx, blockLimitExpected, "Error in Block Limit");
    }

    function testWinner()
        public
    {
        // Initial values
        RockPaperScissors.Move rock = RockPaperScissors.Move.rock;
        RockPaperScissors.Move paper = RockPaperScissors.Move.paper;
        RockPaperScissors.Move scissors = RockPaperScissors.Move.scissors;
        // Expected values
        uint playerOneExpected = 1;
        uint playerTwoExpected = 2;
        uint drawExpected = 3;
        // Transactions
        uint tx1 = uint(r.winner(paper, rock));
        uint tx2 = uint(r.winner(scissors, paper));
        uint tx3 = uint(r.winner(rock, scissors));
        uint tx4 = uint(r.winner(rock, paper));
        uint tx5 = uint(r.winner(paper, scissors));
        uint tx6 = uint(r.winner(scissors, rock));
        uint tx7 = uint(r.winner(rock, rock));
        uint tx8 = uint(r.winner(paper, paper));
        uint tx9 = uint(r.winner(scissors, scissors));
        // Asserts
        Assert.equal(tx1, playerOneExpected, "1. winner test: Player One should win");
        Assert.equal(tx2, playerOneExpected, "2. winner test: Player One should win");
        Assert.equal(tx3, playerOneExpected, "3. winner test: Player One should win");
        Assert.equal(tx4, playerTwoExpected, "4. winner test: Player Two should win");
        Assert.equal(tx5, playerTwoExpected, "5. winner test: Player Two should win");
        Assert.equal(tx6, playerTwoExpected, "6. winner test: Player Two should win");
        Assert.equal(tx7, drawExpected, "7. winner test: Should be a draw");
        Assert.equal(tx8, drawExpected, "8. winner test: Should be a draw");
        Assert.equal(tx9, drawExpected, "9. winner test: Should be a draw");
    }
}