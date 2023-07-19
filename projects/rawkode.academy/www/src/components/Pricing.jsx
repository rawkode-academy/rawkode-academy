import { humanize } from "@lib/utils/textConverter.ts";
import { useState } from "react";
import PricingCard from "./PricingCard.jsx";

const Pricing = ({ data }) => {
  const [isCounter, setIsCounter] = useState(false);
  const [start, setStart] = useState(false);

  const handleChange = () => {
    setIsCounter(true);
    setStart(!start);
  };

  return (
    <section className="section" data-aos="fade-in" data-aos-delay="150">
      <div className="container">
        <div className="row">
          <div className="mb-12 text-center md:col-12">
            {data.monthly_yearly_toggle === "toggle" && (
              <div className="pricing-switch mb-6 flex w-full items-center justify-center">
                <label
                  className="m-0 block text-h6 font-semibold text-black"
                  id="monthly"
                >
                  {humanize(data.billing.monthly)}
                </label>
                <div className="toggle mx-2">
                  <input
                    className="pricing-check peer w-full"
                    type="checkbox"
                    onChange={handleChange}
                  />
                  <b className="switch w-full peer-checked:after:left-[22%] peer-checked:after:translate-x-full"></b>
                </div>
                <label
                  className="m-0 text-h6 font-semibold text-black"
                  id="annually"
                >
                  {humanize(data.billing.annually)}
                </label>
              </div>
            )}
            <span className="rounded-xl px-4 py-2 text-primary">
              {data.offer}
            </span>
          </div>
        </div>
        {/* pricing  */}

        <div className="row xl:justify-center">
          <div className="xl:col-10">
            <div className="row">
              {data.pricing_card.map((item, i) => (
                <PricingCard
                  item={item}
                  key={i}
                  start={start}
                  toggle={data.monthly_yearly_toggle}
                />
              ))}
            </div>
          </div>
        </div>
        {/* end */}
      </div>
    </section>
  );
};

export default Pricing;
