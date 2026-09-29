import { useState } from "react";


function StudentSearch({onSearch}){


const [search,setSearch] = useState("");

const [gender,setGender] = useState("");

const [status,setStatus] = useState("");





const handleSearch=(value)=>{

setSearch(value);

onSearch({

search:value,

gender,

status

});


};







const handleGender=(value)=>{

setGender(value);

onSearch({

search,

gender:value,

status

});


};







const handleStatus=(value)=>{

setStatus(value);

onSearch({

search,

gender,

status:value

});


};







return(

<div className="bg-white shadow rounded-xl p-5 mt-6">


<div className="grid grid-cols-1 md:grid-cols-3 gap-4">





<input

type="text"

placeholder="Search student name, admission no, phone..."

value={search}

onChange={(e)=>handleSearch(e.target.value)}

className="border p-3 rounded-lg w-full"

/>








<select

value={gender}

onChange={(e)=>handleGender(e.target.value)}

className="border p-3 rounded-lg"

>


<option value="">

All Gender

</option>


<option value="Male">

Male

</option>


<option value="Female">

Female

</option>



</select>








<select

value={status}

onChange={(e)=>handleStatus(e.target.value)}

className="border p-3 rounded-lg"

>


<option value="">

All Status

</option>


<option value="Active">

Active

</option>


<option value="Inactive">

Inactive

</option>



</select>





</div>


</div>

);


}


export default StudentSearch;