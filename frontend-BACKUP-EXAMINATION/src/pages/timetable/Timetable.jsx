import TimetableTable from "./TimetableTable";
import TimetableFilters from "./TimetableFilters";
import { useNavigate } from "react-router-dom";


function Timetable(){

const navigate = useNavigate();


return (

<div>


{/* HEADER */}

<div className="flex justify-between items-center mb-6">


<div>

<h1 className="text-3xl font-bold text-gray-800">
Class Timetable
</h1>


<p className="text-gray-600 mt-2">
Manage school class schedules
</p>


</div>





<div className="flex gap-3">



<button

onClick={()=>navigate("/timetable/settings")}

className="bg-purple-600 text-white px-5 py-3 rounded-lg hover:bg-purple-700"

>

⚙ Timetable Settings

</button>





<button

onClick={()=>navigate("/timetable/add")}

className="bg-blue-600 text-white px-5 py-3 rounded-lg hover:bg-blue-700"

>

+ Add Timetable

</button>



</div>



</div>







{/* FILTERS */}

<TimetableFilters/>








{/* TABLE */}

<TimetableTable/>






</div>

);


}


export default Timetable;