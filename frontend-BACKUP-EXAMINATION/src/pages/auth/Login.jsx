import { useState } from "react";
import { supabase } from "../../services/supabase";
import { useNavigate } from "react-router-dom";


function Login(){

const navigate = useNavigate();


const [email,setEmail] = useState("");

const [password,setPassword] = useState("");

const [loading,setLoading] = useState(false);

const [error,setError] = useState("");





const handleLogin = async(e)=>{


e.preventDefault();


try{


setLoading(true);

setError("");





const {

data,

error

}= await supabase.auth.signInWithPassword({

email,

password

});





if(error){

throw error;

}





console.log(
"LOGIN SUCCESS:",
data.user
);





navigate("/");





}catch(err){


console.log(
"LOGIN ERROR:",
err
);


setError(err.message);



}finally{


setLoading(false);


}



};








return(

<div className="min-h-screen flex items-center justify-center bg-slate-100">


<div className="bg-white shadow-xl rounded-xl p-8 w-full max-w-md">



<h1 className="text-3xl font-bold text-center text-blue-700 mb-6">

AFRICORE ERP

</h1>




<p className="text-center text-gray-500 mb-6">

School Enterprise Management System

</p>





<form

onSubmit={handleLogin}

className="space-y-4"

>





<div>


<label className="block mb-1">

Email

</label>


<input


type="email"

required

value={email}

onChange={(e)=>setEmail(e.target.value)}

placeholder="admin@africore.com"

className="w-full border rounded p-3"

/>


</div>






<div>


<label className="block mb-1">

Password

</label>


<input


type="password"

required

value={password}

onChange={(e)=>setPassword(e.target.value)}

placeholder="Password"

className="w-full border rounded p-3"

/>


</div>








{

error &&

<div className="bg-red-100 text-red-700 p-3 rounded">

{error}

</div>

}







<button


disabled={loading}


className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded"


>


{

loading

?

"Logging in..."

:

"LOGIN"

}


</button>







</form>





</div>


</div>


);


}


export default Login;