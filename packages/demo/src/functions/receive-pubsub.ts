export const receivePubSub = (event: { data: string }) => {
  const json = Buffer.from(event.data, 'base64').toString();
  const data = JSON.parse(json);

  console.log(`Hello, ${data.name || 'World'}!`);
};
