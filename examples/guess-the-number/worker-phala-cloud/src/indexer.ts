type Player = {
    maxMaxAttempts: number;
};

type GraphQLResponse = {
    data: {
        players: Player[];
    };
};



export class Indexer {

    private readonly url : string;

    constructor(url: string) {
        this.url = url;
    }

    async getMaxAttempts(address: string): Promise<number | null> {
        const response = await fetch(this.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query: `
                query MyQuery($id: String!) {
                  players(where: { id_eq: $id }) {
                    maxMaxAttempts
                  }
                }
            `,
                variables: {
                    id: address.toLowerCase(),
                },
            }),
        });

        const json: GraphQLResponse = await response.json();

        if (json.data.players.length === 0) {
            return null; // player not found
        }

        return json.data.players[0].maxMaxAttempts;
    }
}