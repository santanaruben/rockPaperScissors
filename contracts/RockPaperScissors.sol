pragma solidity >=0.5.0 <0.6.0;

import "./SafeMath.sol";
import "./Killable.sol";

contract RockPaperScissors is Killable{

    event LogPlayerOneMove(bytes32 indexed hash, address indexed playerOne, address indexed playerTwo, uint bet, uint blockLimit);
    event LogPlayerTwoMove(bytes32 indexed hash, Move move, uint amount, uint blockLimit);
    event LogShowMoveOne(bytes32 indexed hash, Move move);
    event LogWinner(bytes32 indexed hash, address indexed winner, address indexed loser, uint bet);
    event LogDraw(bytes32 indexed hash, address indexed playerOne, address indexed playerTwo, uint bet);
    event LogClaimNoGame(bytes32 indexed hash);
    event LogClaimMoveOneNotShown(bytes32 indexed hash);
    event LogWithdrawn(uint amount, address indexed account);

    using SafeMath for uint256;

    uint constant maxBlocksLimit = 86400 / 15;

    enum Move   {   noMove,     //0
                    rock,       //1
                    paper,      //2
                    scissors    //3
                }

    enum Winner {
                    draw,       //0
                    playerOne,  //1
                    playerTwo   //2
                }

    struct Game {
        address playerOne;
        address playerTwo;
        Move moveTwo;
        uint bet;
        uint blockLimit;
    }

    mapping(bytes32 => Game) public games;
    mapping(address => uint) public balances;

    constructor(bool _paused) Pausable(_paused) public {
    }

    //  Create the hash with the moveOne and a security password.
    function hashIt(bytes32 password, Move move)
        public view returns(bytes32 hash) 
    {
        require(move != Move.noMove);
        return keccak256(abi.encodePacked(password, move, msg.sender, address(this)));
    }

    //  Returns the winner move.
    function winner(Move moveOne, Move moveTwo)
        public pure
        returns (Winner)
    {
        require(moveOne != Move.noMove && moveTwo != Move.noMove);
        //same result (range of 3) = same winner. 0=Draw, 1=PlayerOne, 2=PlayerTwo.
        return Winner((3 + uint(moveOne) - uint(moveTwo)) % 3);
    }

    //  Move from player one.
    function playerOneMove(bytes32 hash, address playerTwo, uint blocksLimit)
        public payable
        whenRunning whenAlive
    {
        require(hash != bytes32(0));
        require(playerTwo != address(0));
        Game storage thisGame = games[hash];
        require(thisGame.playerOne == address(0));
        thisGame.playerOne = msg.sender;
        thisGame.playerTwo = playerTwo;
        thisGame.bet = msg.value;
        uint blockLimit = block.number.add(blocksLimit);
        thisGame.blockLimit = blockLimit;
        emit LogPlayerOneMove(hash, msg.sender, playerTwo, msg.value, blockLimit);
    }

    //  Move from player two.
    function playerTwoMove(bytes32 hash, Move move)
        public payable
        whenRunning whenAlive
    {
        require(move != Move.noMove);
        Game storage thisGame = games[hash];
        require(thisGame.playerTwo == msg.sender && thisGame.moveTwo == Move.noMove);
        balances[msg.sender] = balances[msg.sender].add(msg.value).sub(thisGame.bet);
        thisGame.moveTwo = move;
        uint blockLimit = block.number.add(maxBlocksLimit);  //One day limit to show
        thisGame.blockLimit = blockLimit;
        emit LogPlayerTwoMove(hash, move, msg.value, blockLimit);
    }

    //  Show the move from player one. And declare the winner.
    function showMoveOne(bytes32 password, Move moveOne)
        public
        whenRunning whenAlive
    {
        bytes32 hash = hashIt(password, moveOne);
        Game storage thisGame = games[hash];
        Move moveTwo = thisGame.moveTwo;
        require(moveTwo != Move.noMove);
        emit LogShowMoveOne(hash, moveOne);
        address playerOne = thisGame.playerOne;
        address playerTwo = thisGame.playerTwo;
        uint bet = thisGame.bet;
        clearGame(hash);
        Winner win = winner(moveOne, moveTwo);
        if (win == Winner.playerOne) { 
            emit LogWinner(hash, playerOne, playerTwo, bet);
            if ( bet > 0) balances[playerOne] = balances[playerOne].add(bet.mul(2));
        } else if (win == Winner.playerTwo) { 
            emit LogWinner(hash, playerTwo, playerOne, bet);
            if ( bet > 0) balances[playerTwo] = balances[playerTwo].add(bet.mul(2));
        } else if (win == Winner.draw) { 
            emit LogDraw(hash, playerOne, playerTwo, bet);
            if ( bet > 0) {
                balances[playerOne] = balances[playerOne].add(bet);
                balances[playerTwo] = balances[playerTwo].add(bet);
            }
        } else { assert(false); }
    }

    //  Clear the game. And playerOne remains, so the Hash can not be used again.
    function clearGame(bytes32 hash)
        private
        whenRunning whenAlive
    {
        Game storage thisGame = games[hash];
        thisGame.playerTwo = address(0);
        thisGame.bet = 0;
        thisGame.blockLimit = 0;
        thisGame.moveTwo = Move.noMove;
    }

    //  If there is not player two
    function claimNoGame(bytes32 hash)
        public
        whenRunning whenAlive
    {
        Game storage thisGame = games[hash];
        uint bet = thisGame.bet;
        require(block.number > thisGame.blockLimit);
        require(thisGame.playerTwo != address(0));
        require(thisGame.moveTwo == Move.noMove);
        clearGame(hash);
        emit LogClaimNoGame(hash);
        if (bet > 0) {
            address playerOne = thisGame.playerOne;
            balances[playerOne] = balances[playerOne].add(bet);
        }
    }

    //  If player one doesn't show his move
    function claimMoveOneNotShown(bytes32 hash)
        public
        whenRunning whenAlive
    {
        Game storage thisGame = games[hash];
        address playerOne = thisGame.playerOne;
        address playerTwo = thisGame.playerTwo;
        uint bet = thisGame.bet;
        require(
                    block.number > thisGame.blockLimit  &&
                    thisGame.moveTwo != Move.noMove
                );
        clearGame(hash);
        emit LogClaimMoveOneNotShown(hash);
        emit LogWinner(hash, playerTwo, playerOne, bet);
        if (bet > 0) balances[playerTwo] = balances[playerTwo].add(bet.mul(2));
        else {}
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