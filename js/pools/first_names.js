// js/pools/first_names.js
// Common first names. Club word lists include bare first names ("ian", "dean") because they are
// useful padding, but on their own they say nothing about the club, so the passphrase widget only
// picks them when a club has too few other words. Kept separate from football.js so that file can be
// edited freely.
const COMMON_FIRST_NAMES = [
  "aaron", "abdoulaye", "abraham", "adam", "adebayo", "adrian", "aitor", "alan", "alex", "alexander", "alexis",
  "alfie", "ali", "allan", "andre", "andrea", "andy", "ange", "angel", "anthony", "antoine", "antonio", "ashley",
  "austin", "ben", "benito", "bill", "billy", "bob", "bobby", "brendan", "brenden", "brennan", "brett", "brian",
  "bruce", "bruno", "bryan", "callum", "cameron", "carl", "carlo", "carlos", "carlton", "charles", "charlie",
  "chris", "christian", "christophe", "christopher", "claude", "claudio", "clint", "clive", "cody", "colin",
  "connor", "conor", "craig", "crysencio", "curtis", "cyril", "dan", "daniel", "danny", "darrell", "darren", "dave",
  "david", "dean", "declan", "dele", "denis", "dennis", "derek", "des", "dick", "dimitar", "dion", "dixie",
  "dominic", "don", "doug", "douglas", "duncan", "dwight", "eddie", "edwin", "emile", "emiliano", "emlyn", "enzo",
  "eric", "erik", "ethan", "fabian", "fernando", "francesco", "francis", "frank", "freddie", "gareth", "garry",
  "gary", "geoff", "george", "georgi", "geraint", "gerard", "gerry", "gianluca", "glenn", "gordon", "graeme",
  "graham", "greg", "gregory", "gus", "harry", "howard", "hugo", "iain", "ian", "igor", "illan", "isaac", "ivan",
  "jack", "jackie", "jake", "james", "jamie", "jan", "jarrod", "jason", "jay", "jayden", "jeff", "jeremy", "jermain",
  "jermaine", "jerome", "jim", "jimmy", "joao", "jobe", "joe", "joel", "joey", "johannes", "john", "johnnie",
  "johnny", "jon", "jonathan", "jonny", "jordan", "jose", "josh", "juan", "julian", "junior", "jurgen", "justin",
  "kalvin", "karl", "kasey", "keith", "ken", "kenny", "kevin", "kieffer", "kieran", "kieron", "kyle", "laurie",
  "lawrence", "lawrie", "lee", "leighton", "len", "lennie", "leon", "leroy", "les", "lester", "lewis", "liam",
  "lloyd", "lou", "louis", "lucas", "luis", "luka", "luke", "lyle", "malcolm", "malky", "manuel", "marc", "marco",
  "marcus", "mark", "martin", "mason", "massimo", "matej", "mateusz", "matheus", "mathias", "matt", "matthew",
  "matty", "mauricio", "max", "mel", "michael", "michail", "mick", "mickey", "micky", "miguel", "mike", "mikel",
  "mohamed", "morgan", "nathan", "neil", "niall", "nick", "nicky", "nicolas", "nigel", "noel", "nolan", "norman",
  "oliver", "ollie", "owen", "pablo", "paddy", "paolo", "pat", "patrick", "paul", "paulo", "pedro", "pep", "per",
  "pete", "peter", "petr", "phil", "pier", "rafa", "rafael", "rasmus", "ray", "ricardo", "richard", "richie",
  "rickie", "ricky", "rio", "rob", "robbie", "robert", "roberto", "rodney", "roger", "romain", "roman", "romelu",
  "ron", "ronald", "ronnie", "rory", "roy", "ruben", "russell", "ruud", "ryan", "sabri", "sam", "sammie", "scott",
  "sean", "seth", "shane", "shaun", "simon", "sol", "solly", "stan", "stephen", "steve", "steven", "stuart", "sven",
  "ted", "teddy", "teemu", "terry", "thomas", "tim", "titus", "todd", "tom", "tommy", "tony", "trevor", "troy",
  "tyrone", "unai", "uwe", "vic", "vincent", "virgil", "walter", "wayne", "wes", "wilf", "wilfried", "will",
  "willie", "youri",
];

export default COMMON_FIRST_NAMES;