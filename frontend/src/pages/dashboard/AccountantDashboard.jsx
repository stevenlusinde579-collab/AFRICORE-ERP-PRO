import {
    useNavigate
} from "react-router-dom";

import {
    MdAccountBalance,
    MdPayment,
    MdMoneyOff,
    MdAssessment
} from "react-icons/md";


function AccountantDashboard() {

    const navigate = useNavigate();


    const items = [

        {
            title: "Finance Dashboard",
            description: "View the school's financial overview.",
            path: "/finance/dashboard",
            icon: <MdAccountBalance />,
            color: "text-blue-600"
        },

        {
            title: "Record Payment",
            description: "Record student and school payments.",
            path: "/finance/record-payment",
            icon: <MdPayment />,
            color: "text-green-600"
        },

        {
            title: "Add Expense",
            description: "Record school expenses.",
            path: "/finance/add-expense",
            icon: <MdMoneyOff />,
            color: "text-red-600"
        },

        {
            title: "Chart of Accounts",
            description: "Manage financial accounts.",
            path: "/finance/chart-of-accounts",
            icon: <MdAssessment />,
            color: "text-purple-600"
        }

    ];


    return (

        <div>

            <div className="mb-8">

                <h1 className="
                    text-3xl
                    font-bold
                    text-gray-800
                ">

                    Accountant Dashboard

                </h1>


                <p className="
                    text-gray-600
                    mt-2
                ">

                    Financial management and school accounting overview.

                </p>

            </div>


            <div className="
                grid
                grid-cols-1
                md:grid-cols-2
                lg:grid-cols-4
                gap-6
            ">

                {items.map(item => (

                    <button

                        key={item.title}

                        type="button"

                        onClick={() =>
                            navigate(item.path)
                        }

                        className="
                            bg-white
                            border
                            rounded-xl
                            shadow
                            p-6
                            text-left
                            hover:shadow-lg
                            transition
                        "

                    >

                        <div className={`
                            text-4xl
                            ${item.color}
                        `}>

                            {item.icon}

                        </div>


                        <h2 className="
                            text-lg
                            font-bold
                            text-gray-800
                            mt-4
                        ">

                            {item.title}

                        </h2>


                        <p className="
                            text-gray-500
                            text-sm
                            mt-2
                        ">

                            {item.description}

                        </p>

                    </button>

                ))}

            </div>

        </div>

    );

}


export default AccountantDashboard;