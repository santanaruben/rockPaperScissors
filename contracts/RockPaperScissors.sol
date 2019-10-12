pragma solidity >=0.5.0 <0.6.0;

import "./SafeMath.sol";
import "./Killable.sol";

contract RockPaperScissors is Killable{

    event LogPlayerOneMove(bytes32 moveHashed, address playerOne, address playerTwo, uint bet, uint moveTwoBlockLimit);
    event LogPlayerTwoMove(bytes32 moveHashed, uint move, uint amount, uint showMoveOneBlockLimit);
    event LogShowMoveOne(bytes32 moveHashed, uint move);
    event LogWinner(bytes32 moveHashed, address winner, address loser, uint bet);
    event LogDraw(bytes32 moveHashed, address playerOne, address playerTwo, uint bet);
    event LogWithdrawn(uint amount, address indexed account);

    using SafeMath for uint256;

    uint constant maxBlockDaysLimit = 86400 / 15;   // One day of blocks limit

    struct Game {
        address playerOne;
        address playerTwo;
        uint bet;
        uint moveTwoBlockLimit;
        uint showMoveOneBlockLimit;
        uint moveOne;                               // Moves: 0=NoMove, 1=Rock, 2=Paper, 3=Scissors
        uint moveTwo;
    }

    mapping(bytes32 => Game) public games;
    mapping(address => uint) public balances;

    constructor(bool _paused) Pausable(_paused) public {
    }

    //  Create the hash with the moveOne and a security password.
    function hashIt(bytes32 password, uint move)
        public view returns(bytes32 hash) 
    {
        require((1 <= move) && (move <= 3));
        return keccak256(abi.encodePacked(password, move, address(this)));
    }

    //  Returns the winner move. 1=PlayerOne, 2=PlayerTwo, 3=Draw.
    function winner(uint moveOne, uint moveTwo)
        public pure
        returns (uint)
    {
        require(((1 <= moveOne) && (moveOne <= 3)) && ((1 <= moveTwo) && (moveTwo <= 3)));
        if (moveOne == moveTwo) return 3;      // Draw
        if ((moveOne == 1 && moveTwo == 3) ||
            (moveOne == 2 && moveTwo == 1) ||
            (moveOne == 3 && moveTwo == 2))
            return 1;                          // Player One Wins
        else
            return 2;                          // Player Two Wins
    }

    //  Move from player one.
    function playerOneMove(bytes32 moveHashed, address playerTwo)
        public payable
        whenRunning whenAlive
    {
        require(playerTwo != address(0));
        Game storage thisGame = games[moveHashed];
        require(    
                    thisGame.playerOne == address(0)    &&
                    thisGame.playerTwo == address(0)    &&
                    thisGame.bet == 0                   &&
                    thisGame.moveTwoBlockLimit == 0     &&
                    thisGame.showMoveOneBlockLimit == 0 &&
                    thisGame.moveOne == 0               &&
                    thisGame.moveTwo == 0
                );
        thisGame.playerOne = msg.sender;
        thisGame.playerTwo = playerTwo;
        thisGame.bet = msg.value;
        uint blockLimit = block.number.add(maxBlockDaysLimit);  //One day limit to play
        thisGame.moveTwoBlockLimit = blockLimit;
        emit LogPlayerOneMove(moveHashed, msg.sender, playerTwo, msg.value, blockLimit);
    }

    //  Move from player two.
    function playerTwoMove(bytes32 moveHashed, uint move)
        public payable
        whenRunning whenAlive
    {
        require(move >= 1 && move <= 3);
        Game storage thisGame = games[moveHashed];
        require(
                    thisGame.playerOne != address(0)            &&
                    thisGame.playerTwo == msg.sender            &&
                    thisGame.moveTwoBlockLimit != 0             &&
                    thisGame.showMoveOneBlockLimit == 0         &&
                    thisGame.moveOne == 0                       &&
                    thisGame.moveTwo == 0
                );
        balances[msg.sender] = balances[msg.sender].add(msg.value);
        uint balance = balances[msg.sender];
        uint bet = thisGame.bet;
        require(balance >= bet);
        balances[msg.sender] = balance.sub(bet);
        thisGame.moveTwo = move;
        uint blockLimit = block.number.add(maxBlockDaysLimit);  //One day limit to show
        thisGame.showMoveOneBlockLimit = blockLimit;
        emit LogPlayerTwoMove(moveHashed, move, msg.value, blockLimit);
    }

    //  Show the move from player one. And declare the winner.
    function showMoveOne(bytes32 password, uint moveOne)
        public
        whenRunning whenAlive
    {
        bytes32 moveHashed = hashIt(password, moveOne);
        Game storage thisGame = games[moveHashed];
        uint moveTwo = thisGame.moveTwo;
        require(
                    thisGame.moveOne == 0       &&
                    moveTwo != 0
                );
        thisGame.moveOne = moveOne;
        emit LogShowMoveOne(moveHashed, moveOne);
        address playerOne = thisGame.playerOne;
        address playerTwo = thisGame.playerTwo;
        uint bet = thisGame.bet;
        clearGame(moveHashed);
        uint win = winner(moveOne, moveTwo);
        if (bet > 0)
        {
            if (win == 1){
                balances[playerOne] = balances[playerOne].add(bet.mul(2));
                emit LogWinner(moveHashed, playerOne, playerTwo, bet);
            }
            else if (win == 2) {
                balances[playerTwo] = balances[playerTwo].add(bet.mul(2));
                emit LogWinner(moveHashed, playerTwo, playerOne, bet);
            }
            else if (win == 3){
                balances[playerOne] = balances[playerOne].add(bet);
                balances[playerTwo] = balances[playerTwo].add(bet);
                emit LogDraw(moveHashed, playerOne, playerTwo, bet);
            }
        }
        else {
            if (win == 1){
                emit LogWinner(moveHashed, playerOne, playerTwo, bet);
            }
            else if (win == 2) {
                emit LogWinner(moveHashed, playerTwo, playerOne, bet);
            }
            else if (win == 3){
                emit LogDraw(moveHashed, playerOne, playerTwo, bet);
            }
        }
    }

    //  Clear the game. And the Hash could be used again.
    function clearGame(bytes32 moveHashed)
        private
        whenRunning whenAlive
    {
        Game storage thisGame = games[moveHashed];
        thisGame.playerOne = address(0);
        thisGame.playerTwo = address(0);
        thisGame.bet = 0;
        thisGame.moveTwoBlockLimit = 0;
        thisGame.showMoveOneBlockLimit = 0;
        thisGame.moveOne = 0;
        thisGame.moveTwo = 0;
    }

    //  If there is not player two
    function claimNoGame(bytes32 moveHashed)
        public
        whenRunning whenAlive
    {
        Game storage thisGame = games[moveHashed];
        address playerOne = thisGame.playerOne;
        uint bet = thisGame.bet;
        require(
                    block.number > thisGame.moveTwoBlockLimit   &&
                    playerOne != address(0)                     &&
                    thisGame.playerTwo == address(0)            &&
                    thisGame.moveOne != 0                       &&
                    thisGame.moveTwo == 0
                );
        clearGame(moveHashed);
        if (bet > 0)
            balances[playerOne] = balances[playerOne].add(bet);
    }

    //  If the player one don't show his move
    function claimMoveTwoNotShowed(bytes32 moveHashed)
        public
        whenRunning whenAlive
    {
        Game storage thisGame = games[moveHashed];
        address playerOne = thisGame.playerOne;
        address playerTwo = thisGame.playerTwo;
        uint bet = thisGame.bet;
        require(
                    block.number > thisGame.showMoveOneBlockLimit   &&
                    playerOne != address(0)                         &&
                    playerTwo != address(0)                         &&
                    thisGame.moveOne != 0                           &&
                    thisGame.moveTwo != 0
                );
        clearGame(moveHashed);
        if (bet > 0) {
            balances[playerTwo] = balances[playerTwo].add(bet.mul(2));
            emit LogWinner(moveHashed, playerTwo, playerOne, bet);
        }
        else
            emit LogWinner(moveHashed, playerTwo, playerOne, bet);
    }

    //  Withdraw msg.sender funds
    function withdraw()
        public
        whenRunning whenAlive
    {
        uint amount = balances[msg.sender];
        require(amount > 0, "Not money to withdraw");
        balances[msg.sender] = 0;
        emit LogWithdrawn(amount, msg.sender);
        (bool success, ) = msg.sender.call.value(amount)("");
        require(success, "Transfer failed.");
    }

    // The owner withdraw the contract funds.
    function emergencyWithdraw()
        public
        onlyOwner whenDead
    {
        uint amount = address(this).balance;
        require(amount > 0, "Not money to withdraw.");
        emit LogWithdrawn(amount, msg.sender);
        (bool success, ) = msg.sender.call.value(amount)("");
        require(success, "Transfer failed.");
    }

}