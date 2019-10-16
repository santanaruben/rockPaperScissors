pragma solidity >=0.5.0 <0.6.0;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/RockPaperScissors.sol";

contract TestRockPaperScissors {

    uint public initialBalance = 0.01 ether;
    uint public constant amountToSend = 0.01 ether;
    uint public constant userBlocksLimit = 10;
    uint public constant maxBlocksLimit = 86400 / 15;
    address playerTwo;
    RockPaperScissors r;
    bytes32 hash;

    constructor()
        public
    {
        playerTwo = 0xFAf56184419A832E3274C739D7fc8e39942B52e2;
        r = new RockPaperScissors(false);
        hash = r.hashIt(bytes32(0), RockPaperScissors.Move.rock);
    }
    function testPlayerOneMove()
        public
    {
        // Initial values
        uint balanceContractInitial = address(r).balance;
        (,,,uint playerOneBetInitial,) = r.games(hash);
        // Expected values
        uint balanceContractExpected = balanceContractInitial + amountToSend;
        uint playerOneBetExpected = playerOneBetInitial + amountToSend;
        uint blockLimitExpected = block.number + userBlocksLimit;
        // Transaction
        r.playerOneMove.value(amountToSend)(hash, playerTwo, userBlocksLimit);
        // Values after transaction
        uint balanceContractAfterTx = address(r).balance;
        (,,,uint playerOneBetAfterTx, uint blockLimitAfterTx) = r.games(hash);
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
        uint draw = uint(RockPaperScissors.Winner.draw);
        uint player1 = uint(RockPaperScissors.Winner.playerOne);
        uint player2 = uint(RockPaperScissors.Winner.playerTwo);
        // Asserts
        Assert.equal(uint(r.winner(paper, rock)), player1, "1. winner test: Player One should win");
        Assert.equal(uint(r.winner(scissors, paper)), player1, "2. winner test: Player One should win");
        Assert.equal(uint(r.winner(rock, scissors)), player1, "3. winner test: Player One should win");
        Assert.equal(uint(r.winner(rock, paper)), player2, "4. winner test: Player Two should win");
        Assert.equal(uint(r.winner(paper, scissors)), player2, "5. winner test: Player Two should win");
        Assert.equal(uint(r.winner(scissors, rock)), player2, "6. winner test: Player Two should win");
        Assert.equal(uint(r.winner(rock, rock)), draw, "7. winner test: Should be a draw");
        Assert.equal(uint(r.winner(paper, paper)), draw, "8. winner test: Should be a draw");
        Assert.equal(uint(r.winner(scissors, scissors)), draw, "9. winner test: Should be a draw");
    }
}