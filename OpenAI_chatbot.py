import openai

# API key
client = openai.OpenAI(api_key="key")

def get_response(messages):
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=messages,
        max_tokens=150,
        temperature=0.7,
    )
    return response.choices[0].message['content'].strip()

def main():
    messages = [{"role": "system", "content": "You are a helpful assistant."}]
    print("Chatbot: Hello! How can I help you? Type 'bye' to exit.")
    while True:
        user_input = input("You: ")
        if user_input.lower() == 'bye':
            print("Chatbot: Goodbye! Take care!")
            break
        messages.append({"role": "user", "content": user_input})
        response = get_response(messages)
        print(f"Chatbot: {response}")
        messages.append({"role": "assistant", "content": response})

if __name__ == "__main__":
    main()
