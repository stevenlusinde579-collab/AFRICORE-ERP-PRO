import axios from "axios";


export const askGemini = async (prompt)=>{

try{


const response = await axios.post(

`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,


{

contents:[

{

parts:[

{

text:`

You are AfriCore ERP PRO Educational AI Analysis Engine.

You are an expert school examination analyst.

Analyze the examination data provided.

RULES:

1. Count only main questions.

Example:

Question 1:
(a)
(b)
(c)

This is ONE question.

2. Ignore:

- marks
- instructions
- page numbers
- headings

3. Analyze:

- Subject
- Class/Level
- Total questions
- Topics tested
- Question distribution
- Difficulty level
- Skills tested
- Examination quality

4. Give recommendations for teachers.

Return ONLY valid JSON.

FORMAT:

{
"subject":"",
"level":"",
"total_questions":0,

"topics_found":[

{
"topic":"",
"questions":[]
}

],

"difficulty":"",

"quality_score":0,


"question_analysis":[

{

"question_number":1,

"topic":"",

"skill":""

}

],


"recommendations":""

}


EXAMINATION DATA:

${prompt}

`

}

]

}

]

}

,


{

headers:{

"Content-Type":"application/json"

}

}


);



let result =

response.data
?.candidates?.[0]
?.content
?.parts?.[0]
?.text;



if(!result){

return "{}";

}


// remove markdown JSON wrapper

result = result

.replace("```json","")

.replace("```","")

.trim();



return result;



}

catch(error){


console.log(

"Gemini Error:",

error.response?.data || error.message

);



throw error;


}


};