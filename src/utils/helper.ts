import * as anchor from "@coral-xyz/anchor";
import {
  Commitment,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";

export function convertFromDecimalBN(
  amount: string | number,
  decimals: number
) {
  const [integerPart, fractionalPart = ""] = amount.toString().split(".");
  const paddedFractionalPart = fractionalPart.padEnd(decimals, "0");
  return new anchor.BN(integerPart + paddedFractionalPart);
}

export const useWallet = (
  keypair: Keypair,
  url: string = "http://127.0.0.1:8899",
  commitment: Commitment = "confirmed"
) => {
  url = url !== "mock" ? url : "http://127.0.0.1:8899";
  const wallet = new Wallet(keypair, url, commitment);

  return {
    publicKey: wallet._publicKey,
    sendAndConfirmTransaction: wallet.sendAndConfirmTransaction,
    signMessage: wallet.signMessage,
    signTransaction: wallet.signTransaction,
    signAllTransactions: wallet.signAllTransactions,
    sendTransaction: wallet.sendTransaction,
  };
};

class Wallet {
  _publicKey: PublicKey;
  _keypair: Keypair;
  _connection: Connection;
  _url: string;
  _commitment: Commitment;

  constructor(keypair: Keypair, url: string, commitment: Commitment) {
    this._publicKey = keypair.publicKey;
    this._keypair = keypair;
    this._connection = new Connection(url);
    this._url = url;
    this._commitment = commitment;
  }

  signTransaction = async (tx: any): Promise<any> => {
    await tx.sign([this._keypair!]);
    return tx;
  };

  sendTransaction = async (
    transaction: VersionedTransaction
  ): Promise<string> => {
    const signature = await this._connection.sendTransaction(transaction);
    return signature;
  };

  signAllTransactions = async <T extends Transaction | VersionedTransaction>(
    transactions: T[]
  ): Promise<T[]> => {
    const signedTxs = await Promise.all(
      transactions.map(async (tx) => {
        return await this.signTransaction(tx);
      })
    );
    return signedTxs;
  };

  signMessage = async (message: Uint8Array): Promise<Uint8Array> => {
    // @ts-ignore
    return sign.detached(message, this._keypair.secretKey);
  };

  sendAndConfirmTransaction = async (
    transaction: Transaction,
    signers = []
  ): Promise<any> => {
    const response = await sendAndConfirmTransaction(
      this._connection,
      transaction,
      [this._keypair, ...signers],
      {
        commitment: this._commitment,
      }
    );
    return response;
  };
}
