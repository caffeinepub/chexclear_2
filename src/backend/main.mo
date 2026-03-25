import Map "mo:core/Map";
import Text "mo:core/Text";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Iter "mo:core/Iter";
import Runtime "mo:core/Runtime";

actor {
  type Client = {
    id : Text;
    name : Text;
    address : Text;
    cityStateZip : Text;
    dob : Text;
    ssnLast4 : Text;
    phone : Text;
    reportText : Text;
    status : Text; // "new"|"letter_sent"|"waiting"|"resolved"|"denied"
    createdAt : Text;
  };

  type ClientInput = {
    name : Text;
    address : Text;
    cityStateZip : Text;
    dob : Text;
    ssnLast4 : Text;
    phone : Text;
    reportText : Text;
    status : Text; // "new"|"letter_sent"|"waiting"|"resolved"|"denied"
    createdAt : Text;
  };

  type Letter = {
    id : Text;
    clientId : Text;
    title : Text;
    text : Text;
    createdAt : Text;
    status : Text; // "draft"|"sent"|"printed"
  };

  type LetterInput = {
    clientId : Text;
    title : Text;
    text : Text;
    createdAt : Text;
    status : Text; // "draft"|"sent"|"printed"
  };

  type Note = {
    clientId : Text;
    text : Text;
    updatedAt : Text;
  };

  let clients = Map.empty<Text, Client>();
  let letters = Map.empty<Text, Letter>();
  let notes = Map.empty<Text, Note>();

  func generateId() : Text {
    Time.now().toText();
  };

  // Client Operations
  public shared ({ caller }) func createClient(input : ClientInput) : async Text {
    let id = generateId();
    let client : Client = { input with id };
    clients.add(id, client);
    id;
  };

  public query ({ caller }) func getClients() : async [Client] {
    clients.values().toArray();
  };

  public shared ({ caller }) func updateClient(client : Client) : async Bool {
    if (not clients.containsKey(client.id)) {
      return false;
    };
    clients.add(client.id, client);
    true;
  };

  public shared ({ caller }) func deleteClient(clientId : Text) : async Bool {
    if (not clients.containsKey(clientId)) {
      return false;
    };
    clients.remove(clientId);

    // Remove associated letters
    let lettersToRemove = letters.toArray().filter(func((id, letter)) { letter.clientId == clientId });
    lettersToRemove.forEach(func((id, _)) { letters.remove(id) });

    // Remove associated note
    notes.remove(clientId);
    true;
  };

  // Letter Operations
  public shared ({ caller }) func createLetter(input : LetterInput) : async Text {
    if (not clients.containsKey(input.clientId)) {
      Runtime.trap("Client not found " # input.clientId);
    };
    let id = generateId();
    let letter : Letter = { input with id };
    letters.add(id, letter);
    id;
  };

  public query ({ caller }) func getLettersByClient(clientId : Text) : async [Letter] {
    letters.toArray().filter(func((id, letter)) { letter.clientId == clientId }).map(func((id, letter)) { letter });
  };

  public shared ({ caller }) func updateLetter(letter : Letter) : async Bool {
    if (not letters.containsKey(letter.id)) {
      return false;
    };
    letters.add(letter.id, letter);
    true;
  };

  public shared ({ caller }) func deleteLetter(letterId : Text) : async Bool {
    if (not letters.containsKey(letterId)) {
      return false;
    };
    letters.remove(letterId);
    true;
  };

  // Note Operations
  public shared ({ caller }) func upsertNote(clientId : Text, text : Text, updatedAt : Text) : async Bool {
    if (not clients.containsKey(clientId)) {
      return false;
    };
    let note : Note = { clientId; text; updatedAt };
    notes.add(clientId, note);
    true;
  };

  public query ({ caller }) func getNoteByClient(clientId : Text) : async ?Note {
    notes.get(clientId);
  };
};
