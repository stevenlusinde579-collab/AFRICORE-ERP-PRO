import { NavLink } from "react-router-dom";

import {
  FaTachometerAlt,
  FaUserGraduate,
  FaChalkboardTeacher,
  FaBook,
  FaSchool,
  FaCalendarAlt,
  FaClipboardList,
  FaCog,
  FaUserTie,
  FaMoneyBillWave,
  FaComments,
  FaRobot
} from "react-icons/fa";



function Sidebar(){


const menu=[


{
name:"Dashboard",
path:"/dashboard",
icon:<FaTachometerAlt/>
},



{
name:"Teachers",
path:"/teachers",
icon:<FaChalkboardTeacher/>
},



{
name:"Students",
path:"/students",
icon:<FaUserGraduate/>
},



{
name:"Classes",
path:"/classes",
icon:<FaSchool/>
},



{
name:"Subjects",
path:"/subjects",
icon:<FaBook/>
},



{
name:"Teacher Assignment",
path:"/teacher-assignment",
icon:<FaUserTie/>
},



{
name:"Timetable",
path:"/timetable",
icon:<FaCalendarAlt/>
},



{
name:"Examination",
path:"/examination",
icon:<FaClipboardList/>
},



{
name:"Finance",
path:"/finance",
icon:<FaMoneyBillWave/>
},



{
name:"Communication",
path:"/communication",
icon:<FaComments/>
},



{
name:"AI",
path:"/ai",
icon:<FaRobot/>
},



{
name:"Settings",
path:"/settings",
icon:<FaCog/>
}


];








return(


<aside className="w-64 min-h-screen bg-slate-900 text-white p-5">



<div className="mb-8">


<h1 className="text-2xl font-bold">

AfriCore ERP PRO

</h1>


<p className="text-sm text-gray-400">

School Management System

</p>


</div>







<nav className="space-y-2">


{

menu.map((item)=>(


<NavLink


key={item.name}


to={item.path}



className={({isActive})=>

`

flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200

${
isActive

?

"bg-blue-600 text-white shadow-lg"

:

"text-gray-300 hover:bg-slate-800 hover:text-white"

}

`

}



>



<span className="text-lg">

{item.icon}

</span>



<span>

{item.name}

</span>



</NavLink>



))


}



</nav>






</aside>


);


}



export default Sidebar;