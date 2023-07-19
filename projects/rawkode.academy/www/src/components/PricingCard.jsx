import React from "react";
import { BsPinAngleFill } from "react-icons/bs/index.js";

const PricingCard = ({ item, start, toggle }) => {
  return (
    <div className="mt-6 md:col-6 lg:col-4">
      <div className="rounded-2xl border-0 shadow-[0_10px_34px_rgb(0,0,0,0.05)]">
        <div className="p-8">
          <h3 className="h4 mb-1 font-semibold">{item.name}</h3>
          <span className="h3 inline-flex font-bold text-dark">
            {item.currency}

            {toggle === "monthly" ? (
              item.monthly_price
            ) : toggle === "yearly" ? (
              item.yearly_price
            ) : (
              <span>{!start ? item.monthly_price : item.yearly_price}</span>
            )}
          </span>
          <span className="text-monthly inline">
            {toggle === "monthly"
              ? "/Month"
              : toggle === "yearly"
              ? "/Year"
              : start
              ? "/Year"
              : "/Month"}
          </span>
          <p className="mb-4 border-b pb-4">{item.content}</p>
          <ul className="mb-6 mt-4">
            {item.services.map((service, i) => (
              <li className="mb-2" key={`service-${i}`}>
                <span className="mr-2">
                  <BsPinAngleFill className="mr-1 inline h-[14px] w-[14px] text-primary" />
                </span>
                {service}
              </li>
            ))}
          </ul>
          <a
            href={item.button_link}
            className={`btn block text-center ${
              item.featured
                ? "btn-primary"
                : "btn-outline-primary rounded-md text-primary after:bg-primary hover:bg-transparent"
            }`}
          >
            {item.button_label}
          </a>
        </div>
      </div>
    </div>
  );
};

export default PricingCard;
