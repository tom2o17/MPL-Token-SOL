import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SplMinter } from "../target/types/spl_minter";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
  getMint,
} from "@solana/spl-token";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

describe("spl-minter", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.SplMinter as Program<SplMinter>;
  const provider = anchor.AnchorProvider.local();
  // const payer = (provider.wallet as NodeWallet).payer;

  // Metaplex Constants
  const METADATA_SEED = "metadata";
  const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

  // Constants from our program
  const MINT_SEED = "mint";

  // Data for our tests
  let payer = provider.wallet.publicKey;
  const metadata = {
    name: "Just a Test Token",
    symbol: "TEST",
    uri: "https://5vfxc4tr6xoy23qefqbj4qx2adzkzapneebanhcalf7myvn5gzja.arweave.net/7UtxcnH13Y1uBCwCnkL6APKsge0hAgacQFl-zFW9NlI",
    decimals: 9,
  };
  const mintAmount = 10;
  const [mint] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(MINT_SEED)],
    program.programId
  );

  const [metadataAddress] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from(METADATA_SEED),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );
  
  // Test init token
  it("initialize", async () => {
    const info = await provider.connection.getAccountInfo(mint);
    if (info) {
      return; // Do not attempt to initialize if already initialized
    }
    console.log("  Mint not found. Attempting to initialize.");
   
    const context = {
      metadata: metadataAddress,
      mint,
      payer,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      };
  
      const txHash = await program.methods
        .initToken(metadata)
        .accounts(context)
        .rpc();
  
      await provider.connection.confirmTransaction(txHash, 'finalized');
      const newInfo = await provider.connection.getAccountInfo(mint);
      assert(newInfo, "  Mint should be initialized.");
  });

  // Test mint tokens
  it("mint tokens", async () => {

    const destination = await anchor.utils.token.associatedAddress({
      mint: mint,
      owner: provider.wallet.publicKey,
    });  

    console.log(`Destination is: ${destination}`);

    let initialBalance: number;
    try {
      const balance = (await provider.connection.getTokenAccountBalance(destination))
      initialBalance = balance.value.uiAmount;
    } catch {
      // Token account not yet initiated has 0 balance
      initialBalance = 0;
    } 

    console.log(`The amount of tokens minted to 'fromAta': ${initialBalance}`);
    const context = {
      mint,
      destination: destination,
      payer,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
    };

    const txHash = await program.methods
      .mintTokens(new anchor.BN(mintAmount * 10 ** metadata.decimals))
      .accounts(context)
      .rpc();
    
    
    await provider.connection.confirmTransaction(txHash);
    const postBal = await provider.connection.getTokenAccountBalance(destination);
    console.log(`The amount of tokens minted to 'fromAta': ${postBal.value.uiAmount}`);

    const postBalance = (
      await provider.connection.getTokenAccountBalance(destination)
    ).value.uiAmount;
    assert.equal(
      initialBalance + mintAmount,
      postBalance,
      "Post balance should equal initial plus mint amount"
    );
    

    console.log("The node wallet pub key is: ", provider.wallet.publicKey);
    let res = await getMint(provider.connection, mint);
    console.log("\n ---- POST execution ------");
    console.log(`The tokens mint authority: ${res.mintAuthority}`);
    console.log(`The tokens freeze authority: ${res.freezeAuthority}`);
    console.log(`The tokens address ${res.address}`);
    console.log(`The program Id is: ${program.programId}`);


  });
});
