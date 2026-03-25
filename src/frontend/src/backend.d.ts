import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface LetterInput {
    status: string;
    title: string;
    clientId: string;
    createdAt: string;
    text: string;
}
export interface ClientInput {
    dob: string;
    status: string;
    name: string;
    createdAt: string;
    cityStateZip: string;
    ssnLast4: string;
    reportText: string;
    address: string;
    phone: string;
}
export interface Letter {
    id: string;
    status: string;
    title: string;
    clientId: string;
    createdAt: string;
    text: string;
}
export interface Client {
    id: string;
    dob: string;
    status: string;
    name: string;
    createdAt: string;
    cityStateZip: string;
    ssnLast4: string;
    reportText: string;
    address: string;
    phone: string;
}
export interface Note {
    clientId: string;
    text: string;
    updatedAt: string;
}
export interface backendInterface {
    createClient(input: ClientInput): Promise<string>;
    createLetter(input: LetterInput): Promise<string>;
    deleteClient(clientId: string): Promise<boolean>;
    deleteLetter(letterId: string): Promise<boolean>;
    getClients(): Promise<Array<Client>>;
    getLettersByClient(clientId: string): Promise<Array<Letter>>;
    getNoteByClient(clientId: string): Promise<Note | null>;
    updateClient(client: Client): Promise<boolean>;
    updateLetter(letter: Letter): Promise<boolean>;
    upsertNote(clientId: string, text: string, updatedAt: string): Promise<boolean>;
}
