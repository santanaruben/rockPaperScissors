pragma solidity >=0.5.0 <0.6.0;

import "./SafeMath.sol";
import "./Killable.sol";

contract RockPaperScissors is Killable{

    event LogPlayerOneMove(bytes32 indexed moveHashed, address indexed playerOne, address playerTwo, uint bet, uint blockLimit);
    event LogPlayerTwoMove(bytes32 indexed moveHashed, uint move, uint amount, uint blockLimit);
    event LogShowMoveOne(bytes32 indexed moveHashed, uint move);
    event LogWinner(bytes32 indexed moveHashed, address indexed winner, address indexed loser, uint bet);
    event LogDraw(bytes32 indexed moveHashed, address indexed playerOne, address indexed playerTwo, uint bet);
    event LogWithdrawn(uint amount, address indexed account);

    using SafeMath for uint256;

    uint constant maxBlockDaysLimit = 86400 / 15;   // One day of blocks limit

    enum Move   {   noMove,     //0
                    rock,       //1
                    paper,      //2
                    scissors    //3
                }

    enum Winner {
                    noWinner,   //0
                    playerOne,  //1
                    playerTwo,  //2
                    draw        //3
                }

    struct Game {
        address playerOne;
        address playerTwo;
        uint bet;
        uint blockLimit;
        Move moveOne;
        Move moveTwo;
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
        return keccak256(abi.encodePacked(password, move, msg.sender, address(this)));
    }

    //  Returns the winner move.
    function winner(uint moveOne, uint moveTwo)
        public pure
        returns (Winner)
    {
        require(((1 <= moveOne) && (moveOne <= 3)) && ((1 <= moveTwo) && (moveTwo <= 3)));
        //same result (range of 3) = same winner. 0=Draw, 1=PlayerOne, 2=PlayerTwo.
        uint result = ((3 + moveOne) - moveTwo) % 3;    
        if (result == 1)
            return Winner.playerOne;
        else if (result == 2)
            return Winner.playerTwo;
        else 
            return Winner.draw;
        
    }

    //  Move from player one.
    function playerOneMove(bytes32 moveHashed, address playerTwo)
        public payable
        whenRunning whenAlive
    {
        require(playerTwo != address(0));
        Game storage thisGame = games[moveHashed];
        require(thisGame.playerOne == address(0));
        thisGame.playerOne = msg.sender;
        thisGame.playerTwo = playerTwo;
        thisGame.bet = msg.value;
        uint blockLimit = block.number.add(maxBlockDaysLimit);  //One day limit to play
        thisGame.blockLimit = blockLimit;
        emit LogPlayerOneMove(moveHashed, msg.sender, playerTwo, msg.value, blockLimit);
    }

    //  Move from player two.
    function playerTwoMove(bytes32 moveHashed, uint move)
        public payable
        whenRunning whenAlive
    {
        require(move >= 1 && move <= 3);
        Game storage thisGame = games[moveHashed];
        require(thisGame.playerTwo == msg.sender && thisGame.moveTwo == Move.noMove);
        uint balanceInitial = balances[msg.sender];
        uint balanceWithValueSent = balanceInitial.add(msg.value);
        uint bet = thisGame.bet;
        balances[msg.sender] = balanceWithValueSent.sub(bet);
        thisGame.moveTwo = Move(move);
        uint blockLimit = block.number.add(maxBlockDaysLimit);  //One day limit to show
        thisGame.blockLimit = blockLimit;
        emit LogPlayerTwoMove(moveHashed, move, msg.value, blockLimit);
    }

    //  Show the move from player one. And declare the winner.
    function showMoveOne(bytes32 password, uint moveOne)
        public
        whenRunning whenAlive
    {
        bytes32 moveHashed = hashIt(password, moveOne);
        Game storage thisGame = games[moveHashed];
        Move moveTwo = thisGame.moveTwo;
        require(thisGame.moveOne == Move.noMove && moveTwo != Move.noMove);
        thisGame.moveOne = Move(moveOne);
        emit LogShowMoveOne(moveHashed, moveOne);
        address playerOne = thisGame.playerOne;
        address playerTwo = thisGame.playerTwo;
        uint bet = thisGame.bet;
        clearGame(moveHashed);
        Winner win = winner(moveOne, uint(moveTwo));
        if (bet > 0)
        {
            if (win == Winner.playerOne){
                balances[playerOne] = balances[playerOne].add(bet.mul(2));
                emit LogWinner(moveHashed, playerOne, playerTwo, bet);
            }
            else if (win == Winner.playerTwo) {
                balances[playerTwo] = balances[playerTwo].add(bet.mul(2));
                emit LogWinner(moveHashed, playerTwo, playerOne, bet);
            }
            else if (win == Winner.draw){
                balances[playerOne] = balances[playerOne].add(bet);
                balances[playerTwo] = balances[playerTwo].add(bet);
                emit LogDraw(moveHashed, playerOne, playerTwo, bet);
            }
        }
        else {
            if (win == Winner.playerOne){
                emit LogWinner(moveHashed, playerOne, playerTwo, bet);
            }
            else if (win == Winner.playerTwo) {
                emit LogWinner(moveHashed, playerTwo, playerOne, bet);
            }
            else if (win == Winner.draw){
                emit LogDraw(moveHashed, playerOne, playerTwo, bet);
            }
        }
    }

    //  Clear the game. And playerOne remains, so the Hash can not be used again.
    function clearGame(bytes32 moveHashed)
        private
        whenRunning whenAlive
    {
        Game storage thisGame = games[moveHashed];
        thisGame.playerTwo = address(0);
        thisGame.bet = 0;
        thisGame.blockLimit = 0;
        thisGame.moveOne = Move.noMove;
        thisGame.moveTwo = Move.noMove;
    }

    //  If there is not player two
    function claimNoGame(bytes32 moveHashed)
        public
        whenRunning whenAlive
    {
        Game storage thisGame = games[moveHashed];
        uint bet = thisGame.bet;
        require(block.number > thisGame.blockLimit && thisGame.moveTwo == Move.noMove);
        clearGame(moveHashed);
        if (bet > 0) {
            address playerOne = thisGame.playerOne;
            balances[playerOne] = balances[playerOne].add(bet);
        }
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
                    block.number > thisGame.blockLimit  &&
                    thisGame.moveOne == Move.noMove     &&
                    thisGame.moveTwo != Move.noMove
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