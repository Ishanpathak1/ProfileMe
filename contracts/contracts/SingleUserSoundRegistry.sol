// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SingleUserSoundRegistry
/// @notice Minimal registry storing a single user's sound hash for demo.
contract SingleUserSoundRegistry {
    address public owner;
    address public user;
    bytes32 private _soundHash;

    event SoundHashSet(address indexed user, bytes32 indexed soundHash);

    constructor(address _user, bytes32 initialHash) {
        owner = msg.sender;
        user = _user;
        _soundHash = initialHash;
        emit SoundHashSet(_user, initialHash);
    }

    /// @notice Read the registered hash. Returns zero for non-configured accounts.
    function soundHashOf(address account) external view returns (bytes32) {
        return account == user ? _soundHash : bytes32(0);
    }

    /// @notice Owner-only update of the stored hash.
    function setSoundHash(bytes32 newHash) external {
        require(msg.sender == owner, "not owner");
        _soundHash = newHash;
        emit SoundHashSet(user, newHash);
    }
}

