interface User {
  id: number;
  username: string;
  password: string;
  create_time: number;
  update_time: number;
}

class MemoryDB {
  private static users: User[] = [];
  private static userIdCounter = 1;

  static getUser(username: string): User | undefined {
    return this.users.find(u => u.username === username);
  }

  static createUser(username: string, password: string): User {
    const now = Math.floor(Date.now() / 1000);
    const user: User = {
      id: this.userIdCounter++,
      username,
      password,
      create_time: now,
      update_time: now
    };
    this.users.push(user);
    return user;
  }
}

export { MemoryDB };
